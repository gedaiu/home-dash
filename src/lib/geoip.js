const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

// In-memory cache
const cache = new Map();
const dnsCache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const DNS_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day for DNS

// Persistent cache file
const CACHE_FILE = path.join(__dirname, '../../data/ip-cache.json');

// Rate limiting for external API
let lastApiCall = 0;
const API_RATE_LIMIT = 50; // ms between calls

// Try to load geoip-lite if available
let geoipLite = null;
try {
  geoipLite = require('geoip-lite');
  console.log('[geoip] Using geoip-lite for lookups');
} catch {
  console.log('[geoip] geoip-lite not installed, will use ip-api.com');
}

// Load persistent cache
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      for (const [ip, entry] of Object.entries(data)) {
        if (Date.now() - entry.timestamp < CACHE_TTL) {
          cache.set(ip, entry);
        }
      }
      console.log(`[geoip] Loaded ${cache.size} cached entries`);
    }
  } catch (err) {
    console.error('[geoip] Error loading cache:', err.message);
  }
}

// Save persistent cache
function saveCache() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {};
    for (const [ip, entry] of cache) {
      data[ip] = entry;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[geoip] Error saving cache:', err.message);
  }
}

// Check if IP is private/reserved and should be skipped
function isPrivateOrReserved(ip) {
  if (!ip || typeof ip !== 'string') {
    return true;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [a, b] = parts;

  // Private ranges
  if (a === 10) return true;                           // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16

  // Link-local
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16

  // Loopback
  if (a === 127) return true;                          // 127.0.0.0/8

  // Multicast
  if (a >= 224 && a <= 239) return true;              // 224.0.0.0/4

  // Broadcast
  if (a === 255) return true;                          // 255.0.0.0/8

  // Current network
  if (a === 0) return true;                            // 0.0.0.0/8

  return false;
}

// Reverse DNS lookup with caching
async function reverseDns(ip) {
  const cached = dnsCache.get(ip);
  if (cached && Date.now() - cached.timestamp < DNS_CACHE_TTL) {
    return cached.hostname;
  }

  try {
    const hostnames = await dns.reverse(ip);
    const hostname = hostnames && hostnames.length > 0 ? hostnames[0] : null;
    dnsCache.set(ip, { hostname, timestamp: Date.now() });
    return hostname;
  } catch {
    dnsCache.set(ip, { hostname: null, timestamp: Date.now() });
    return null;
  }
}

// Resolver status tracking
const resolverStatus = {
  total: 0,
  resolved: 0,
  pending: 0,
  inProgress: false
};

function getResolverStatus() {
  return { ...resolverStatus };
}

// Lookup IP address
async function lookup(ip) {
  // Skip private/reserved IPs
  if (isPrivateOrReserved(ip)) {
    return null;
  }

  // Check cache first
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // If cached but missing hostname, try to resolve it
    if (cached.data && cached.data.hostname === undefined) {
      const hostname = await reverseDns(ip);
      if (hostname) {
        cached.data.hostname = hostname;
      }
    }
    return cached.data;
  }

  // Do reverse DNS lookup (non-blocking, cached)
  const hostname = await reverseDns(ip);

  // Try geoip-lite first (local database, fast)
  if (geoipLite) {
    const result = geoipLite.lookup(ip);
    if (result) {
      const data = {
        ip,
        hostname,
        country: result.country,
        countryName: getCountryName(result.country),
        region: result.region,
        city: result.city,
        ll: result.ll,
        timezone: result.timezone
      };

      cache.set(ip, { data, timestamp: Date.now() });
      return data;
    }
  }

  // Fall back to ip-api.com (free tier: 45 requests/minute)
  try {
    const data = await fetchFromIpApi(ip);
    data.hostname = hostname;
    cache.set(ip, { data, timestamp: Date.now() });

    // Periodically save cache
    if (cache.size % 100 === 0) {
      saveCache();
    }

    return data;
  } catch (err) {
    // Cache failed lookups to prevent repeated API calls for the same IP
    cache.set(ip, { data: null, timestamp: Date.now() });
    console.error(`[geoip] Lookup failed for ${ip}:`, err.message);
    return null;
  }
}

// Fetch from ip-api.com
async function fetchFromIpApi(ip) {
  // Rate limiting
  const now = Date.now();
  const elapsed = now - lastApiCall;
  if (elapsed < API_RATE_LIMIT) {
    await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT - elapsed));
  }
  lastApiCall = Date.now();

  const url = `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error('Empty response from ip-api.com');
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }

  if (json.status === 'fail') {
    throw new Error(json.message);
  }

  return {
    ip,
    country: json.countryCode,
    countryName: json.country,
    region: json.region,
    regionName: json.regionName,
    city: json.city,
    zip: json.zip,
    lat: json.lat,
    lon: json.lon,
    timezone: json.timezone,
    isp: json.isp,
    org: json.org,
    as: json.as,
    asName: json.asname
  };
}

// Country code to name mapping (common ones)
const countryNames = {
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
  return countryNames[code] || code;
}

// Batch lookup for multiple IPs
async function lookupBatch(ips) {
  const results = {};
  const uncached = [];

  // Check cache for all IPs
  for (const ip of ips) {
    const cached = cache.get(ip);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results[ip] = cached.data;
    } else {
      uncached.push(ip);
    }
  }

  // Lookup uncached IPs (with rate limiting)
  for (const ip of uncached) {
    try {
      results[ip] = await lookup(ip);
    } catch {
      results[ip] = null;
    }
  }

  return results;
}

// Resolve hostnames for all cached entries that don't have them
async function resolveAllHostnames(onProgress) {
  if (resolverStatus.inProgress) {
    return { success: false, message: 'Resolution already in progress' };
  }

  const ipsToResolve = [];

  for (const [ip, entry] of cache) {
    if (entry.data && entry.data.hostname === undefined) {
      ipsToResolve.push(ip);
    }
  }

  resolverStatus.total = ipsToResolve.length;
  resolverStatus.resolved = 0;
  resolverStatus.pending = ipsToResolve.length;
  resolverStatus.inProgress = true;

  if (onProgress) {
    onProgress({ ...resolverStatus });
  }

  for (const ip of ipsToResolve) {
    try {
      const hostname = await reverseDns(ip);
      const cached = cache.get(ip);
      if (cached && cached.data) {
        cached.data.hostname = hostname;
      }
      resolverStatus.resolved++;
      resolverStatus.pending--;

      if (onProgress) {
        onProgress({ ...resolverStatus });
      }
    } catch {
      resolverStatus.resolved++;
      resolverStatus.pending--;
    }
  }

  resolverStatus.inProgress = false;

  if (onProgress) {
    onProgress({ ...resolverStatus });
  }

  saveCache();

  return { success: true, resolved: resolverStatus.resolved };
}

// Initialize
loadCache();

// Save cache periodically
setInterval(saveCache, 60 * 1000);

// Save cache on exit
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
