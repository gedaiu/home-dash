jest.mock('axios');
const axios = require('axios');
const { authenticate } = require('../../src/auth/nanoleaf');

describe('nanoleaf auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('returns success with authToken on valid response', async () => {
      axios.post.mockResolvedValue({
        data: { auth_token: 'test-token-123' }
      });

      const result = await authenticate('192.168.1.100', 16021, 1);

      expect(result).toEqual({
        success: true,
        authToken: 'test-token-123'
      });
      expect(axios.post).toHaveBeenCalledWith(
        'http://192.168.1.100:16021/api/v1/new',
        {},
        { timeout: 5000 }
      );
    });

    it('returns error when auth_token missing from response', async () => {
      axios.post.mockResolvedValue({
        data: {}
      });

      const result = await authenticate('192.168.1.100', 16021, 1);

      expect(result).toEqual({
        success: false,
        error: 'Invalid response: missing auth_token'
      });
    });

    it('returns retriesExhausted when 403 and max retries reached', async () => {
      axios.post.mockRejectedValue({
        response: { status: 403 }
      });

      const result = await authenticate('192.168.1.100', 16021, 1);

      expect(result).toEqual({
        success: false,
        error: 'Not in pairing mode',
        retriesExhausted: true
      });
    });

    it('returns connection error on ECONNREFUSED', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNREFUSED'
      });

      const result = await authenticate('192.168.1.100', 16021, 1);

      expect(result).toEqual({
        success: false,
        error: 'Cannot connect to 192.168.1.100:16021'
      });
    });

    it('returns generic error for other failures', async () => {
      axios.post.mockRejectedValue(new Error('Network timeout'));

      const result = await authenticate('192.168.1.100', 16021, 1);

      expect(result).toEqual({
        success: false,
        error: 'Network timeout'
      });
    });

    it('retries on 403 until max retries', async () => {
      axios.post
        .mockRejectedValueOnce({ response: { status: 403 } })
        .mockRejectedValueOnce({ response: { status: 403 } })
        .mockResolvedValueOnce({ data: { auth_token: 'success-token' } });

      const result = await authenticate('192.168.1.100', 16021, 3);

      expect(result).toEqual({
        success: true,
        authToken: 'success-token'
      });
      expect(axios.post).toHaveBeenCalledTimes(3);
    });
  });
});
