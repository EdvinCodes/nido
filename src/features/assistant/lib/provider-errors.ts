/**
 * Maps provider/SDK failures to short, actionable messages (never stack traces).
 */
export function mapProviderError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : 'Unknown provider error';
  const lower = raw.toLowerCase();

  if (
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('aborted') ||
    lower.includes('deadline')
  ) {
    return {
      status: 504,
      code: 'provider_timeout',
      message: 'The model timed out. Try again, or switch to a faster local model.',
    };
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('ratelimit') ||
    lower.includes('429') ||
    lower.includes('too many requests')
  ) {
    return {
      status: 429,
      code: 'provider_rate_limit',
      message: 'The model provider rate-limited this request. Wait a minute and try again.',
    };
  }

  if (
    lower.includes('invalid api key') ||
    lower.includes('incorrect api key') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('authentication') ||
    lower.includes('api key')
  ) {
    return {
      status: 502,
      code: 'provider_auth',
      message:
        'The configured AI API key was rejected. Check AI_PROVIDER credentials in the server environment.',
    };
  }

  if (
    lower.includes('econnrefused') ||
    lower.includes('fetch failed') ||
    lower.includes('enotfound')
  ) {
    return {
      status: 502,
      code: 'provider_unreachable',
      message:
        'Could not reach the model provider. If you use Ollama, confirm it is running locally.',
    };
  }

  return {
    status: 502,
    code: 'provider_error',
    message: 'The model provider failed. Check server logs and try again.',
  };
}
