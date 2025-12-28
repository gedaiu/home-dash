const geoip = require('../lib/geoip');

// Connected router agents
const agents = new Map();

// Current state
let state = {
  routers: [],
  devices: [],
  connections: []
};

// Broadcast function (set by websocket.js)
let broadcastFn = null;

// Connection tracking with enrichment
const connectionMap = new Map();
const deviceMap = new Map();

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(data) {
  if (broadcastFn) {
    broadcastFn(data);
  }
}

function getState() {
  return state;
}

function getRouters() {
  return state.routers;
}

function getDevices() {
  return Array.from(deviceMap.values());
}

function getConnections() {
  return Array.from(connectionMap.values());
}

// Handle agent WebSocket connection
function handleAgentConnection(ws) {
  console.log('[openwrt] Agent connected');

  let agentId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleAgentMessage(ws, data);

      if (data.router && !agentId) {
        agentId = data.router;
        agents.set(agentId, { ws, lastSeen: Date.now() });
        updateRouterStatus(agentId, true, data);
      }
    } catch (err) {
      console.error('[openwrt] Error handling agent message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[openwrt] Agent disconnected:', agentId);
    if (agentId) {
      agents.delete(agentId);
      updateRouterStatus(agentId, false);
    }
  });

  ws.on('error', (err) => {
    console.error('[openwrt] Agent WebSocket error:', err);
    if (agentId) {
      agents.delete(agentId);
      updateRouterStatus(agentId, false);
    }
  });
}

// Handle messages from agents
async function handleAgentMessage(ws, data) {
  const { type, router, name, role, time } = data;

  switch (type) {
    case 'identify':
      console.log(`[openwrt] Agent identified: ${data.router}`);
      break;

    case 'stats':
      handleStatsMessage(router, name, role, data.data);
      break;

    case 'device':
      handleDeviceMessage(router, data.data);
      break;

    case 'conntrack':
      await handleConntrackMessage(router, data.data);
      break;

    case 'traffic':
      handleTrafficMessage(router, data.data);
      break;
  }
}

// Handle router stats
function handleStatsMessage(routerId, routerName, role, statsData) {
  const router = state.routers.find(r => r.id === routerId);

  const stats = {
    id: routerId,
    name: routerName || routerId,
    role: role || 'main',
    online: true,
    lastSeen: Date.now(),
    ip: statsData.ip || null,
    cpu: statsData.cpu?.usage || 0,
    memory: statsData.memory?.percent || 0,
    temp: statsData.temps?.[0]?.value || null,
    uptime: statsData.uptime || 0,
    loadAvg: statsData.load_avg || []
  };

  if (router) {
    Object.assign(router, stats);
  } else {
    state.routers.push(stats);
  }

  broadcast({
    type: 'openwrt:status',
    data: state.routers
  });
}

// Handle device presence updates
function handleDeviceMessage(routerId, devices) {
  if (!Array.isArray(devices)) {
    devices = [devices];
  }

  for (const device of devices) {
    const key = device.mac;
    const existing = deviceMap.get(key);

    if (existing) {
      // Update existing device
      Object.assign(existing, device);
      existing.lastSeen = Date.now();
    } else {
      // New device
      deviceMap.set(key, {
        ...device,
        firstSeen: Date.now(),
        lastSeen: Date.now()
      });
    }
  }

  state.devices = Array.from(deviceMap.values());

  broadcast({
    type: 'openwrt:devices',
    data: state.devices
  });
}

// Handle connection tracking events
async function handleConntrackMessage(routerId, events) {
  if (!Array.isArray(events)) {
    events = [events];
  }

  for (const event of events) {
    const key = `${event.protocol}-${event.src_ip}:${event.src_port}-${event.dst_ip}:${event.dst_port}`;

    if (event.action === 'DESTROY') {
      connectionMap.delete(key);
    } else {
      // Enrich destination IP with GeoIP data
      let enriched = null;
      if (event.dst_ip && !isPrivateIP(event.dst_ip)) {
        enriched = await geoip.lookup(event.dst_ip);
      }

      // Find source device MAC from our device list
      const srcDevice = Array.from(deviceMap.values()).find(d => d.ip === event.src_ip);

      connectionMap.set(key, {
        ...event,
        router: routerId,
        srcMac: srcDevice?.mac || null,
        srcHostname: srcDevice?.hostname || null,
        enriched,
        lastSeen: Date.now()
      });
    }
  }

  // Prune old connections (older than 5 minutes)
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, conn] of connectionMap) {
    if (conn.lastSeen < cutoff) {
      connectionMap.delete(key);
    }
  }

  state.connections = Array.from(connectionMap.values());

  broadcast({
    type: 'openwrt:connections',
    data: state.connections
  });
}

// Handle traffic statistics
function handleTrafficMessage(routerId, trafficData) {
  // Update device traffic info
  if (Array.isArray(trafficData)) {
    for (const traffic of trafficData) {
      const device = deviceMap.get(traffic.mac);
      if (device) {
        device.traffic = {
          rx: traffic.rx || 0,
          tx: traffic.tx || 0,
          lastUpdate: Date.now()
        };
      }
    }
  }

  broadcast({
    type: 'openwrt:traffic',
    data: trafficData
  });
}

// Update router online status
function updateRouterStatus(routerId, online, data = {}) {
  const router = state.routers.find(r => r.id === routerId);

  if (router) {
    router.online = online;
    router.lastSeen = Date.now();
  } else if (online) {
    state.routers.push({
      id: routerId,
      name: data.name || routerId,
      role: data.role || 'main',
      online: true,
      lastSeen: Date.now()
    });
  }

  broadcast({
    type: 'openwrt:status',
    data: state.routers
  });
}

// Check if an IP is private
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) {
    return false;
  }

  // 10.0.0.0/8
  if (parts[0] === 10) {
    return true;
  }

  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  // 127.0.0.0/8 (localhost)
  if (parts[0] === 127) {
    return true;
  }

  return false;
}

// Get graph data for visualization
function getGraphData() {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  // Add device nodes
  for (const device of deviceMap.values()) {
    const nodeId = `device:${device.mac}`;
    if (!nodeMap.has(nodeId)) {
      nodeMap.set(nodeId, {
        id: nodeId,
        type: 'device',
        label: device.hostname || device.mac,
        ip: device.ip,
        mac: device.mac,
        online: device.online,
        router: device.router
      });
    }
  }

  // Add external service nodes and edges from connections
  const serviceConnections = new Map();

  for (const conn of connectionMap.values()) {
    if (!conn.enriched) {
      continue;
    }

    // Group by organization/domain
    const org = conn.enriched.org || conn.enriched.country || 'Unknown';
    const serviceId = `service:${org}`;

    if (!nodeMap.has(serviceId)) {
      nodeMap.set(serviceId, {
        id: serviceId,
        type: 'service',
        label: org,
        country: conn.enriched.country,
        countryName: conn.enriched.countryName
      });
    }

    // Track connections for edge weights
    const edgeKey = `${conn.srcMac || conn.src_ip}:${serviceId}`;
    const existing = serviceConnections.get(edgeKey);

    if (existing) {
      existing.count++;
      existing.bytes += (conn.bytes || 0);
    } else {
      serviceConnections.set(edgeKey, {
        source: `device:${conn.srcMac}` || `device:${conn.src_ip}`,
        target: serviceId,
        count: 1,
        bytes: conn.bytes || 0
      });
    }
  }

  // Convert to arrays
  nodes.push(...nodeMap.values());

  for (const edge of serviceConnections.values()) {
    if (nodeMap.has(edge.source)) {
      edges.push(edge);
    }
  }

  return { nodes, edges };
}

module.exports = {
  setBroadcast,
  handleAgentConnection,
  getState,
  getRouters,
  getDevices,
  getConnections,
  getGraphData
};
