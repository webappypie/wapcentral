export type ProviderErrorCode =
  | 'AUTH_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'PROVIDER_ERROR'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_TOO_LONG';

export class ProviderError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
    public readonly rawError?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  static fromHttpStatus(providerId: string, status: number, bodyText: string): ProviderError {
    let code: ProviderErrorCode = 'PROVIDER_ERROR';
    let retryable = false;

    if (status === 401 || status === 403) {
      code = 'AUTH_ERROR';
      retryable = false;
    } else if (status === 429) {
      code = 'RATE_LIMITED';
      retryable = true;
    } else if (status === 402) {
      code = 'QUOTA_EXCEEDED';
      retryable = false;
    } else if (status === 404) {
      code = 'MODEL_NOT_FOUND';
      retryable = false;
    } else if (status === 400) {
      if (
        bodyText.toLowerCase().includes('context') ||
        bodyText.toLowerCase().includes('token limit')
      ) {
        code = 'CONTEXT_TOO_LONG';
      } else {
        code = 'INVALID_REQUEST';
      }
      retryable = false;
    } else if (status >= 500) {
      code = 'PROVIDER_ERROR';
      retryable = true;
    }

    return new ProviderError(
      providerId,
      code,
      `[${providerId}] HTTP ${status}: ${bodyText.slice(0, 300)}`,
      retryable,
      status,
    );
  }
}
