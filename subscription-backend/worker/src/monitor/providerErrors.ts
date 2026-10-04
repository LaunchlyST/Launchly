export interface ProviderFailure {
  code: 'PROVIDER_LIMITED' | 'PROVIDER_AUTH_ERROR' | 'PROVIDER_ERROR';
  message: string;
  provider: string;
  connectionType: 'api' | 'subscription' | 'local';
  retryAfter?: string;
}

export class ProviderRequestError extends Error {
  failure: ProviderFailure;
  status: number;
  constructor(failure: ProviderFailure, status: number) {
    super(failure.message);
    this.failure = failure;
    this.status = status;
  }
}

/** Classify actual upstream responses; never infer usage from local counters. */
export async function providerError(response: Response, provider: string, connectionType: 'api' | 'subscription' | 'local' = 'api') {
  const body: any = await response.json().catch(() => null);
  const code = body?.error?.code ?? body?.error?.type;
  const limited = response.status === 429 || ['insufficient_quota', 'quota_exceeded', 'rate_limit_error', 'rate_limit_exceeded', 'credit_balance_too_low'].includes(code)
    || (provider === 'anthropic' && response.status === 400 && /credit balance is too low/i.test(body?.error?.message ?? ''));
  const unauthorized = response.status === 401 || response.status === 403;
  // Don't forward arbitrary upstream text: it may echo request headers or keys.
  const failure: ProviderFailure = {
    code: limited ? 'PROVIDER_LIMITED' : unauthorized ? 'PROVIDER_AUTH_ERROR' : 'PROVIDER_ERROR',
    message: limited
      ? connectionType === 'local' ? 'Subscription usage unavailable or limit reached. Switch to API key?'
      : connectionType === 'subscription' ? 'Your subscription usage is currently limited. Switch to API to continue.' : 'Your API usage is currently limited. Check your provider quota or billing, or connect another API key.'
      : unauthorized ? 'The provider rejected this connection. Reconnect your API key.' : `The AI provider could not complete this request (${response.status}). Try again or check the selected model.`,
    provider, connectionType,
    ...(response.headers.get('retry-after') ? { retryAfter: response.headers.get('retry-after')! } : {}),
  };
  return new ProviderRequestError(failure, limited ? 429 : 502);
}
