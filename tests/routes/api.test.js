const request = require('supertest');

let app;
let storage;

beforeAll(async () => {
  ({ default: app } = await import('../../src/app'));
  ({ default: storage } = await import('../../src/services/storage'));
});

describe('GET /api/sync/status', () => {
  it('returns status 200 with a boolean running flag', async () => {
    const response = await request(app).get('/api/sync/status');

    expect([response.status, typeof response.body.running]).toEqual([200, 'boolean']);
  });
});

describe('GET /api/sync/config', () => {
  it('returns status 200 with an object body', async () => {
    const response = await request(app).get('/api/sync/config');

    expect([response.status, typeof response.body]).toEqual([200, 'object']);
  });
});

describe('GET /api/hue/bridge', () => {
  it('returns status 200 with a configured flag', async () => {
    const response = await request(app).get('/api/hue/bridge');

    expect(response).toMatchObject({ status: 200, body: { configured: expect.any(Boolean) } });
  });
});

describe('GET /api/nanoleaf/device', () => {
  it('returns status 200 with a configured flag', async () => {
    const response = await request(app).get('/api/nanoleaf/device');

    expect(response).toMatchObject({ status: 200, body: { configured: expect.any(Boolean) } });
  });
});

describe('POST /api/hue/bridge/pair', () => {
  it('returns status 400 with an error when ip is missing', async () => {
    const response = await request(app).post('/api/hue/bridge/pair').send({});

    expect(response).toMatchObject({ status: 400, body: { error: expect.any(String) } });
  });
});

describe('POST /api/nanoleaf/device/pair', () => {
  it('returns status 400 with an error when ip is missing', async () => {
    const response = await request(app).post('/api/nanoleaf/device/pair').send({});

    expect(response).toMatchObject({ status: 400, body: { error: expect.any(String) } });
  });
});

describe('PUT /api/sync/config', () => {
  beforeEach(() => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Test', allowChange: true });
  });

  it('returns status 400 with an error when hueDeviceId is missing', async () => {
    const response = await request(app).put('/api/sync/config').send({});

    expect(response).toMatchObject({ status: 400, body: { error: expect.any(String) } });
  });

  it('returns status 200 with success when hueDeviceId 1 is provided', async () => {
    const response = await request(app).put('/api/sync/config').send({ hueDeviceId: 1, hueDeviceName: 'Test Light' });

    expect(response).toMatchObject({ status: 200, body: { success: true } });
  });

  it('returns status 403 and the locked message when allowChange is false', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Locked Light', allowChange: false });

    const response = await request(app).put('/api/sync/config').send({ hueDeviceId: 2, hueDeviceName: 'New Light' });

    expect(response).toMatchObject({ status: 403, body: { error: 'Config changes are locked' } });
  });

  it('keeps device 1 Locked Light when allowChange is false', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Locked Light', allowChange: false });

    await request(app).put('/api/sync/config').send({ hueDeviceId: 2, hueDeviceName: 'New Light' });

    expect(storage.getSync()).toMatchObject({ hueDeviceId: 1, hueDeviceName: 'Locked Light' });
  });

  it('saves device 2 New Light when allowChange is true', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Old Light', allowChange: true });

    await request(app).put('/api/sync/config').send({ hueDeviceId: 2, hueDeviceName: 'New Light' });

    expect(storage.getSync()).toMatchObject({ hueDeviceId: 2, hueDeviceName: 'New Light' });
  });

  it('returns status 200 when allowChange is true', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Old Light', allowChange: true });

    const response = await request(app).put('/api/sync/config').send({ hueDeviceId: 2, hueDeviceName: 'New Light' });

    expect(response.status).toBe(200);
  });

  it('saves device 3 when allowChange is not set', async () => {
    storage.setSync({ hueDeviceId: 1, hueDeviceName: 'Old Light' });

    await request(app).put('/api/sync/config').send({ hueDeviceId: 3, hueDeviceName: 'Another Light' });

    expect(storage.getSync()).toMatchObject({ hueDeviceId: 3 });
  });
});

describe('GET /', () => {
  it('returns status 200 with an html content type', async () => {
    const response = await request(app).get('/');

    expect(response).toMatchObject({ status: 200, headers: { 'content-type': expect.stringMatching(/html/) } });
  });
});
