export class ProviderError extends Error {
  constructor(message, {
    code = 'provider_error',
    status = 502,
    provider = 'unknown',
    providerStatus = null,
    retryable = false,
    publicMessage = 'The selected provider is temporarily unavailable.',
    cause,
  } = {}) {
    super(message, { cause });
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.provider = provider;
    this.providerStatus = providerStatus;
    this.retryable = retryable;
    this.publicMessage = publicMessage;
  }
}

export function providerResponseError(provider, response, operation) {
  const providerStatus = Number(response?.status || 0) || null;
  const retryable = providerStatus === 408 || providerStatus === 409 || providerStatus === 429 || providerStatus >= 500;
  return new ProviderError(`${provider} ${operation} failed (${providerStatus || 'unknown'}).`, {
    code: `${provider}_${operation}_failed`,
    provider,
    providerStatus,
    retryable,
  });
}

export function publicProviderError(error) {
  if (error instanceof ProviderError) {
    return {
      error: error.publicMessage,
      code: error.code,
      provider: error.provider,
      retryable: error.retryable,
    };
  }
  return {
    error: 'The selected provider is temporarily unavailable.',
    code: 'provider_error',
    provider: 'unknown',
    retryable: false,
  };
}
