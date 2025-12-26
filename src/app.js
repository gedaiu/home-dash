const express = require('express');
const path = require('node:path');
const hueRoutes = require('./routes/hue');
const nanoleafRoutes = require('./routes/nanoleaf');
const syncRoutes = require('./routes/sync');
const airpurifierRoutes = require('./routes/airpurifier');
const homeconnectRoutes = require('./routes/homeconnect');
const roombaRoutes = require('./routes/roomba');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/hue', hueRoutes);
app.use('/api/nanoleaf', nanoleafRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/airpurifier', airpurifierRoutes);
app.use('/api/homeconnect', homeconnectRoutes);
app.use('/api/roomba', roombaRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

module.exports = app;
