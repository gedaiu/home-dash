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
});

describe('Static files', () => {
  test('serves index.html', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
  });
});
