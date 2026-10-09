const API_RATE_LIMIT = 50;
const API_TIMEOUT_MS = 10_000;
const ERROR_PREVIEW_LENGTH = 100;
const API_FIELDS = 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname';

let lastApiCall = 0;

async function fetchFromIpApi(address) {
  await waitForRateLimit();

  const url = `http://ip-api.com/json/${address}?fields=${API_FIELDS}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  const json = await readJson(response);

  if (json.status === 'fail') {
    throw new Error(json.message);
  }

  return toLocation(address, json);
}

async function waitForRateLimit() {
  const elapsed = Date.now() - lastApiCall;

  if (elapsed < API_RATE_LIMIT) {
    await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT - elapsed));
  }

  lastApiCall = Date.now();
}

async function readJson(response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();

  if (!text || text.trim() === '') {
    throw new Error('Empty response from ip-api.com');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, ERROR_PREVIEW_LENGTH)}`);
  }
}

function toLocation(address, json) {
  return {
    'ip': address,
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
    'as': json.as,
    asName: json.asname
  };
}

module.exports = { fetchFromIpApi };
