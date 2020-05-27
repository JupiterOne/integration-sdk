import { IntegrationError } from '../../errors';

export class IntegrationMalformedApiKeyError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'MALFORMED_API_KEY_ERROR',
      message,
    });
  }
}

export class IntegrationApiKeyRequiredError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'JUPITER_ONE_API_KEY_ENVIRONMENT_VARIABLE_NOT_SET',
      message,
    });
  }
}

export function malformedApiKeyError() {
  return new IntegrationMalformedApiKeyError('Malformed API Key provided');
}

export function apiKeyRequiredError() {
  return new IntegrationMalformedApiKeyError(
    'The JUPITERONE_API_KEY environment variable must be set',
  );
}
