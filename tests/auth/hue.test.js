let constants;

beforeAll(async () => {
  constants = await import('../../src/auth/hue');
});

describe('hue auth', () => {
  it('exposes APP_NAME and DEVICE_NAME constants', () => {
    const { APP_NAME, DEVICE_NAME } = constants;

    expect({ APP_NAME, DEVICE_NAME }).toEqual({ APP_NAME: 'hue-nanoleaf-sync', DEVICE_NAME: 'cli-scanner' });
  });
});
