const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/sync/status', () => {
  test('returns sync status object', async () => {
    const response = await request(app).get('/api/sync/status');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('running');
    expect(typeof response.body.running).toBe('boolean');
  });
});

describe('GET /api/sync/config', () => {
  test('returns sync config object', async () => {
    const response = await request(app).get('/api/sync/config');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('object');
  });
});

describe('GET /api/hue/bridge', () => {
  test('returns bridge status', async () => {
    const response = await request(app).get('/api/hue/bridge');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('configured');
  });
});

describe('GET /api/nanoleaf/device', () => {
  test('returns device status', async () => {
    const response = await request(app).get('/api/nanoleaf/device');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('configured');
  });
});

describe('POST /api/hue/bridge/pair', () => {
  test('returns 400 when IP is missing', async () => {
    const response = await request(app)
      .post('/api/hue/bridge/pair')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

describe('POST /api/nanoleaf/device/pair', () => {
  test('returns 400 when IP is missing', async () => {
    const response = await request(app)
      .post('/api/nanoleaf/device/pair')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});

describe('PUT /api/sync/config', () => {
  const storage = require('../../src/services/storage');

  beforeEach(() => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Test', allowChange: true });
  });

  test('returns 400 when hueDeviceId is missing', async () => {
    const response = await request(app)
      .put('/api/sync/config')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('saves config when hueDeviceId is provided', async () => {
    const response = await request(app)
      .put('/api/sync/config')
      .send({ hueDeviceId: 1, hueDeviceName: 'Test Light' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('returns 403 when allowChange is false', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Locked Light', allowChange: false });

    const response = await request(app)
      .put('/api/sync/config')
      .send({ hueDeviceId: 2, hueDeviceName: 'New Light' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Config changes are locked');
  });

  test('preserves config when allowChange is false', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Locked Light', allowChange: false });

    await request(app)
      .put('/api/sync/config')
      .send({ hueDeviceId: 2, hueDeviceName: 'New Light' });

    const config = storage.getSync();
    expect(config.hueDeviceId).toBe(1);
    expect(config.hueDeviceName).toBe('Locked Light');
  });

  test('allows changes when allowChange is true', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Old Light', allowChange: true });

    const response = await request(app)
      .put('/api/sync/config')
      .send({ hueDeviceId: 2, hueDeviceName: 'New Light' });

    expect(response.status).toBe(200);
    const config = storage.getSync();
    expect(config.hueDeviceId).toBe(2);
    expect(config.hueDeviceName).toBe('New Light');
  });

  test('allows changes when allowChange is not set', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Old Light' });

    const response = await request(app)
      .put('/api/sync/config')
      .send({ hueDeviceId: 3, hueDeviceName: 'Another Light' });

    expect(response.status).toBe(200);
    const config = storage.getSync();
    expect(config.hueDeviceId).toBe(3);
  });
});

describe('Static files', () => {
  test('serves index.html', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
  });
});
