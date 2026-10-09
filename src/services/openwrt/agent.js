const { agents, logToUI } = require('./state');
const { handleStatsMessage, markRouterOnline, markRouterOffline } = require('./routers');
const { handleDeviceMessage, handleTrafficMessage } = require('./devices');
const { handleConntrackMessage } = require('./connections');

const MESSAGE_HANDLERS = new Map([
  ['identify', message => logToUI(`Agent identified: ${message.router} (${message.name || 'unnamed'})`)],
  ['stats', message => handleStatsMessage({
    routerId: message.router, routerName: message.name, role: message.role, statsData: message.data
  })],
  ['device', message => handleDeviceMessage(message.data)],
  ['conntrack', message => handleConntrackMessage(message.router, message.data)],
  ['traffic', message => handleTrafficMessage(message.data)]
]);

function handleAgentConnection(socket) {
  logToUI('Agent connected');

  const session = { agentId: null };

  socket.on('message', rawMessage => receiveAgentMessage(socket, session, rawMessage));

  socket.on('close', () => {
    logToUI(`Agent disconnected: ${session.agentId}`, 'warning');
    dropAgent(session);
  });

  socket.on('error', (err) => {
    logToUI(`Agent WebSocket error: ${err.message}`, 'error');
    dropAgent(session);
  });
}

async function receiveAgentMessage(socket, session, rawMessage) {
  try {
    const message = JSON.parse(rawMessage);

    await handleAgentMessage(message);
    registerAgent(socket, session, message);
  } catch (err) {
    logToUI(`Error handling agent message: ${err.message}`, 'error');
  }
}

async function handleAgentMessage(message) {
  const handler = MESSAGE_HANDLERS.get(message.type);

  if (handler) {
    await handler(message);
  }
}

function registerAgent(socket, session, message) {
  if (!message.router || session.agentId) {
    return;
  }

  session.agentId = message.router;
  agents.set(session.agentId, { 'ws': socket, lastSeen: Date.now() });
  markRouterOnline(session.agentId, message);
}

function dropAgent(session) {
  if (!session.agentId) {
    return;
  }

  agents.delete(session.agentId);
  markRouterOffline(session.agentId);
}

module.exports = { handleAgentConnection };
