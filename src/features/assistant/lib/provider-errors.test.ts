import { describe, expect, it } from 'vitest';
import { mapProviderError } from './provider-errors';

describe('mapProviderError', () => {
  it('maps timeouts', () => {
    expect(mapProviderError(new Error('Request timeout'))).toMatchObject({
      code: 'provider_timeout',
      status: 504,
    });
  });

  it('maps rate limits', () => {
    expect(mapProviderError(new Error('429 Too Many Requests — rate limit'))).toMatchObject({
      code: 'provider_rate_limit',
      status: 429,
    });
  });

  it('maps invalid keys', () => {
    expect(mapProviderError(new Error('Incorrect API key provided'))).toMatchObject({
      code: 'provider_auth',
      status: 502,
    });
  });

  it('maps unreachable providers', () => {
    expect(mapProviderError(new Error('fetch failed: ECONNREFUSED'))).toMatchObject({
      code: 'provider_unreachable',
      status: 502,
    });
  });
});
