const express = require('express');

const app = express();

app.use(express.json());

const path = require('node:path');
app.use(express.static(path.join(__dirname, '../public')));

const hueRoutes = require('./routes/hue');
app.use('/api/hue', hueRoutes);

const nanoleafRoutes = require('./routes/nanoleaf');
app.use('/api/nanoleaf', nanoleafRoutes);

const syncRoutes = require('./routes/sync');
app.use('/api/sync', syncRoutes);

const homeconnectRoutes = require('./routes/homeconnect');
app.use('/api/homeconnect', homeconnectRoutes);

const roombaRoutes = require('./routes/roomba');
app.use('/api/roomba', roombaRoutes);

const airpurifierRoutes = require('./routes/airpurifier');
app.use('/api/airpurifier', airpurifierRoutes);

const panelsRoutes = require('./routes/panels');
app.use('/api/panels', panelsRoutes);

const openwrtRoutes = require('./routes/openwrt');
app.use('/api/openwrt', openwrtRoutes);

const weatherRoutes = require('./routes/weather');
app.use('/api/weather', weatherRoutes);

const transportRoutes = require('./routes/transport');
app.use('/api/transport', transportRoutes);

const devicesRoutes = require('./routes/devices');
app.use('/api/devices', devicesRoutes);

const metrics = require('./services/metrics');
app.get('/metrics', (req, res) => {
  res.type('text/plain; version=0.0.4').send(metrics.formatMetrics(metrics.collectSnapshot()));
});

const HTTP_INTERNAL_ERROR = 500;
const ERROR_HANDLER_ARITY = 4;

function handleError(err, req, res) {
  console.error(err.stack);
  res.status(HTTP_INTERNAL_ERROR).json({ error: err.message });
}

// Express recognises error handlers by arity 4; the unused `next` is dropped to satisfy max-params.
Object.defineProperty(handleError, 'length', { value: ERROR_HANDLER_ARITY });
app.use(handleError);

module.exports = app;
