const { state, broadcast } = require('./state');

function handleStatsMessage({ routerId, routerName, role, statsData }) {
  const stats = {
    id: routerId,
    name: routerName || routerId,
    role: role || 'main',
    online: true,
    lastSeen: Date.now(),
    ...readHostStats(statsData),
    ...readLoadStats(statsData)
  };

  upsertRouter(routerId, stats);
  broadcastRouters();
}

function upsertRouter(routerId, stats) {
  const router = findRouter(routerId);

  if (router) {
    Object.assign(router, stats);

    return;
  }

  state.routers.push(stats);
}

function readHostStats(statsData) {
  return {
    'ip': statsData.ip || null,
    temp: readTemperature(statsData),
    uptime: statsData.uptime || 0,
    loadAvg: statsData.load_avg || []
  };
}

function readTemperature(statsData) {
  const firstTemp = statsData.temps?.[0];

  return firstTemp?.value || null;
}

function readLoadStats(statsData) {
  return {
    cpu: statsData.cpu?.usage || 0,
    memory: statsData.memory?.percent || 0
  };
}

function markRouterOnline(routerId, agentInfo = {}) {
  const router = findRouter(routerId);

  if (!router) {
    addOnlineRouter(routerId, agentInfo);

    return;
  }

  router.online = true;
  router.lastSeen = Date.now();
  broadcastRouters();
}

function addOnlineRouter(routerId, agentInfo) {
  state.routers.push({
    id: routerId,
    name: agentInfo.name || routerId,
    role: agentInfo.role || 'main',
    online: true,
    lastSeen: Date.now()
  });
  broadcastRouters();
}

function markRouterOffline(routerId) {
  const router = findRouter(routerId);

  if (router) {
    router.online = false;
    router.lastSeen = Date.now();
  }

  broadcastRouters();
}

function findRouter(routerId) {
  return state.routers.find(router => router.id === routerId);
}

function broadcastRouters() {
  broadcast({
    type: 'openwrt:status',
    data: state.routers
  });
}

module.exports = { handleStatsMessage, markRouterOnline, markRouterOffline };
