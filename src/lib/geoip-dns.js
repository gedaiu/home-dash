const dns = require('dns').promises;

const MS_PER_DAY = 86_400_000;
const dnsCache = new Map();

async function reverseDns(address) {
  const cached = dnsCache.get(address);

  if (cached && Date.now() - cached.timestamp < MS_PER_DAY) {
    return cached.hostname;
  }

  try {
    const hostnames = await dns.reverse(address);
    const hostname = hostnames && hostnames.length > 0 ? hostnames[0] : null;
    rememberHostname(address, hostname);

    return hostname;
  } catch {
    rememberHostname(address, null);

    return null;
  }
}

function forgetHostname(address) {
  dnsCache.delete(address);
}

function rememberHostname(address, hostname) {
  dnsCache.set(address, { hostname, timestamp: Date.now() });
}

module.exports = { reverseDns, forgetHostname };
