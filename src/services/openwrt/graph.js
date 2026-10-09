const { connectionMap, deviceMap } = require('./state');

function getGraphData() {
  const nodeMap = new Map();

  addDeviceNodes(nodeMap);

  const serviceEdges = addServiceNodes(nodeMap);
  const edges = Array.from(serviceEdges.values()).filter(edge => nodeMap.has(edge.source));

  return { nodes: Array.from(nodeMap.values()), edges };
}

function addDeviceNodes(nodeMap) {
  for (const device of deviceMap.values()) {
    addNodeIfAbsent(nodeMap, {
      id: `device:${device.mac}`,
      type: 'device',
      label: device.hostname || device.mac,
      'ip': device.ip,
      mac: device.mac,
      online: device.online,
      router: device.router
    });
  }
}

function addServiceNodes(nodeMap) {
  const serviceEdges = new Map();
  const enrichedConnections = Array.from(connectionMap.values()).filter(connection => connection.enriched);

  for (const connection of enrichedConnections) {
    const org = connection.enriched.org || connection.enriched.country || 'Unknown';
    const serviceId = `service:${org}`;

    addNodeIfAbsent(nodeMap, serviceNode(serviceId, org, connection.enriched));
    accumulateEdge(serviceEdges, connection, serviceId);
  }

  return serviceEdges;
}

function serviceNode(serviceId, org, enriched) {
  return {
    id: serviceId,
    type: 'service',
    label: org,
    country: enriched.country,
    countryName: enriched.countryName
  };
}

function accumulateEdge(serviceEdges, connection, serviceId) {
  const edgeKey = `${connection.srcMac || connection.src_ip}:${serviceId}`;
  const existing = serviceEdges.get(edgeKey);

  if (existing) {
    existing.count++;
    existing.bytes += (connection.bytes || 0);

    return;
  }

  serviceEdges.set(edgeKey, {
    source: `device:${connection.srcMac}`,
    target: serviceId,
    count: 1,
    bytes: connection.bytes || 0
  });
}

function addNodeIfAbsent(nodeMap, node) {
  if (!nodeMap.has(node.id)) {
    nodeMap.set(node.id, node);
  }
}

module.exports = { getGraphData };
