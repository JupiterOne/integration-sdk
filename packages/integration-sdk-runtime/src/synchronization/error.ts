import { IntegrationError } from '@jupiterone/integration-sdk-core';
import { AxiosError } from 'axios';
import { SynchronizationApiErrorResponse } from './types';

export class IntegrationMalformedApiKeyError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'MALFORMED_API_KEY_ERROR',
      message,
    });
  }
}

export class IntegrationInstanceNotFound extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'INTEGRATION_INSTANCE_NOT_FOUND',
      message,
    });
  }
}

export function synchronizationApiError(
  err: AxiosError<SynchronizationApiErrorResponse>,
  errorMessage: string,
) {
  if (err.response?.data?.error) {
    // Looks like Axios error response with data
    const responseData: SynchronizationApiErrorResponse = err.response.data;
    const { code, message } = responseData!.error!;
    return new IntegrationError({
      code: 'SYNCRONIZATION_API_RESPONSE_ERROR',
      message: `${errorMessage} (API response: code=${
        code || '<none>'
      }, message="${message || '<none>'}").`,
    });
  } else {
    return new IntegrationError({
      code: 'UNEXPECTED_SYNCRONIZATION_ERROR',
      message: errorMessage,
      cause: err,
    });
  }
}
