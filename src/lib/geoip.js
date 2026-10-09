const { isPrivateOrReserved } = require('./geoip-private-ranges');
const { cache, getFreshEntry, remember, loadCache, saveCache } = require('./geoip-cache');
const { reverseDns, forgetHostname } = require('./geoip-dns');
const { fetchFromIpApi } = require('./geoip-api');

let geoipLite = null;

try {
  geoipLite = require('geoip-lite');
  console.log('[geoip] Using geoip-lite for lookups');
} catch {
  console.log('[geoip] geoip-lite not installed, will use ip-api.com');
}

const resolverStatus = {
  total: 0,
  resolved: 0,
  pending: 0,
  inProgress: false
};

function getResolverStatus() {
  return { ...resolverStatus };
}

async function lookup(address) {
  if (isPrivateOrReserved(address)) {
    return null;
  }

  const cached = getFreshEntry(address);

  if (cached) {
    return fillMissingHostname(address, cached);
  }

  const hostname = await reverseDns(address);
  const localData = lookupLocally(address, hostname);

  if (localData) {
    return localData;
  }

  return lookupRemotely(address, hostname);
}

async function fillMissingHostname(address, cached) {
  const isMissingHostname = cached.data && cached.data.hostname === undefined;

  if (!isMissingHostname) {
    return cached.data;
  }

  const hostname = await reverseDns(address);

  if (hostname) {
    cached.data.hostname = hostname;
  }

  return cached.data;
}

function lookupLocally(address, hostname) {
  const result = geoipLite?.lookup(address);

  if (!result) {
    return null;
  }

  const location = {
    'ip': address,
    hostname,
    country: result.country,
    countryName: getCountryName(result.country),
    region: result.region,
    city: result.city,
    'll': result.ll,
    timezone: result.timezone
  };

  remember(address, location);

  return location;
}

const SAVE_EVERY_N_ENTRIES = 100;

async function lookupRemotely(address, hostname) {
  try {
    const location = await fetchFromIpApi(address);
    location.hostname = hostname;
    remember(address, location);

    if (cache.size % SAVE_EVERY_N_ENTRIES === 0) {
      saveCache();
    }

    return location;
  } catch (err) {
    remember(address, null);
    console.error(`[geoip] Lookup failed for ${address}:`, err.message);

    return null;
  }
}

const COUNTRY_NAMES = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'DE': 'Germany',
  'FR': 'France',
  'CN': 'China',
  'JP': 'Japan',
  'KR': 'South Korea',
  'IN': 'India',
  'BR': 'Brazil',
  'RU': 'Russia',
  'AU': 'Australia',
  'CA': 'Canada',
  'NL': 'Netherlands',
  'IE': 'Ireland',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'SE': 'Sweden',
  'IT': 'Italy',
  'ES': 'Spain',
  'CH': 'Switzerland'
};

function getCountryName(code) {
  return COUNTRY_NAMES[code] || code;
}

async function lookupBatch(addresses) {
  const addressList = [...addresses];
  const cachedAddresses = addressList.filter((address) => getFreshEntry(address));
  const uncachedAddresses = addressList.filter((address) => !getFreshEntry(address));
  const results = {};

  for (const address of cachedAddresses) {
    results[address] = getFreshEntry(address).data;
  }

  for (const address of uncachedAddresses) {
    results[address] = await lookupOrNull(address);
  }

  return results;
}

async function lookupOrNull(address) {
  try {
    return await lookup(address);
  } catch {
    return null;
  }
}

async function resolveAllHostnames(onProgress) {
  console.log('[GeoIP] resolveAllHostnames called, cache size:', cache.size);

  if (resolverStatus.inProgress) {
    console.log('[GeoIP] Resolution already in progress');

    return { success: false, message: 'Resolution already in progress' };
  }

  const addressesToResolve = [...cache].filter(([, entry]) => lacksHostname(entry)).map(([address]) => address);

  console.log('[GeoIP] IPs to resolve:', addressesToResolve.length, 'of', cache.size, 'cached');

  addressesToResolve.forEach(forgetHostname);
  Object.assign(resolverStatus, {
    total: addressesToResolve.length,
    resolved: 0,
    pending: addressesToResolve.length,
    inProgress: true
  });
  reportProgress(onProgress);

  for (const address of addressesToResolve) {
    await resolveHostname(address, onProgress);
  }

  resolverStatus.inProgress = false;
  reportProgress(onProgress);
  saveCache();

  return { success: true, resolved: resolverStatus.resolved };
}

async function resolveHostname(address, onProgress) {
  try {
    const hostname = await reverseDns(address);
    const cached = cache.get(address);

    if (cached && cached.data) {
      cached.data.hostname = hostname;
    }

    markResolved();
    reportProgress(onProgress);
  } catch {
    markResolved();
  }
}

function lacksHostname(entry) {
  return Boolean(entry.data) && (entry.data.hostname === undefined || entry.data.hostname === null);
}

function markResolved() {
  resolverStatus.resolved++;
  resolverStatus.pending--;
}

function reportProgress(onProgress) {
  if (onProgress) {
    onProgress({ ...resolverStatus });
  }
}

const SAVE_INTERVAL_MS = 60_000;

loadCache();
setInterval(saveCache, SAVE_INTERVAL_MS).unref();
process.on('exit', saveCache);
process.on('SIGINT', () => {
  saveCache();
  process.exit();
});

module.exports = {
  lookup,
  lookupBatch,
  getCountryName,
  getResolverStatus,
  resolveAllHostnames
};
