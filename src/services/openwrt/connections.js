const geoip = require('../../lib/geoip');
const { state, connectionMap, deviceMap, broadcast } = require('./state');
const { isPrivateIP } = require('./network');
const { asArray } = require('./devices');

const MS_PER_MINUTE = 60000;
const CONNECTION_TTL_MINUTES = 5;

async function handleConntrackMessage(routerId, reported) {
  for (const event of asArray(reported)) {
    await trackConnection(routerId, event);
  }

  pruneStaleConnections();
  broadcastConnections();
}

async function trackConnection(routerId, event) {
  const key = `${event.protocol}-${event.src_ip}:${event.src_port}-${event.dst_ip}:${event.dst_port}`;

  if (event.action === 'DESTROY') {
    connectionMap.delete(key);

    return;
  }

  const previous = connectionMap.get(key) || {};
  const enriched = await enrichDestination(previous, event);
  const srcDevice = Array.from(deviceMap.values()).find(device => device.ip === event.src_ip);

  connectionMap.set(key, mergeConnection({ previous, event, routerId, enriched, srcDevice }));
}

async function enrichDestination(previous, event) {
  if (previous.enriched) {
    return previous.enriched;
  }

  if (!event.dst_ip || isPrivateIP(event.dst_ip)) {
    return null;
  }

  return geoip.lookup(event.dst_ip);
}

function mergeConnection({ previous, event, routerId, enriched, srcDevice }) {
  return {
    ...previous,
    ...event,
    bytes: peak('bytes', event, previous),
    packets: peak('packets', event, previous),
    router: routerId,
    srcMac: firstKnown(srcDevice?.mac, previous.srcMac),
    srcHostname: firstKnown(srcDevice?.hostname, previous.srcHostname),
    enriched,
    lastSeen: Date.now()
  };
}

function peak(field, event, previous) {
  return Math.max(event[field] || 0, previous[field] || 0);
}

function firstKnown(...candidates) {
  return candidates.find(Boolean) ?? null;
}

function pruneStaleConnections() {
  const cutoff = Date.now() - CONNECTION_TTL_MINUTES * MS_PER_MINUTE;

  for (const [key, connection] of connectionMap) {
    if (connection.lastSeen < cutoff) {
      connectionMap.delete(key);
    }
  }
}

async function refreshConnectionEnrichment() {
  for (const connection of connectionMap.values()) {
    await refreshEnrichment(connection);
  }

  broadcastConnections();
}

async function refreshEnrichment(connection) {
  if (!connection.dst_ip || isPrivateIP(connection.dst_ip)) {
    return;
  }

  const enriched = await geoip.lookup(connection.dst_ip);

  if (enriched) {
    connection.enriched = enriched;
  }
}

function broadcastConnections() {
  state.connections = Array.from(connectionMap.values());

  broadcast({
    type: 'openwrt:connections',
    data: state.connections
  });
}

module.exports = { handleConntrackMessage, refreshConnectionEnrichment };
