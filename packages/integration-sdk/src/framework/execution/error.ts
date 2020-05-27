import { IntegrationError } from '../../errors';

export class IntegrationLocalConfigFieldMissingError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'LOCAL_CONFIG_FIELD_MISSING',
      message,
    });
  }
}

export class IntegrationLocalConfigFieldTypeMismatchError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'LOCAL_CONFIG_FIELD_TYPE_MISMATCH',
      message,
    });
  }
}
export class IntegrationConfigLoadError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'CONFIG_LOAD_ERROR',
      message,
    });
  }
}

export class StepStartStateUnknownStepIdsError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'UNKNOWN_STEP_ID_SPECIFIED_IN_START_STATE',
      message,
    });
  }
}

export class UnaccountedStepStartStatesError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'UNACCOUNTED_STEP_START_STATES',
      message,
    });
  }
}

export class IntegrationDuplicateKeyError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'DUPLICATE_KEY_DETECTED',
      fatal: true,
      message,
    });
  }
}

/**
 * An error that may be thrown by an integration during `validateInvocation`,
 * used to communicate something the user should see that can help them fix a
 * configuration problem.
 */
export class IntegrationValidationError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'CONFIG_VALIDATION_ERROR',
      message,
    });
  }
}

/**
 * An error that may be thrown by an integration during `validateInvocation`,
 * used to communicate a provider API authentication error the user should see
 * that can help them fix a configuration problem. This is a fatal error because
 * an integration cannot reach the provider.
 */
export class IntegrationProviderAuthenticationError extends IntegrationError {
  constructor(options: {
    /**
     * An optional reference to the error that caused this error. The cause tree
     * will be included in logging of the error to assist problem resolution.
     */
    cause?: Error;

    /**
     * The endpoint that provided the response indicating the authentication
     * parameters are invalid.
     */
    endpoint: string;

    /**
     * The response status code, i.e. `401`, or in the case of GraphQL, whatever
     * error code provided by the response body.
     */
    status: string | number;

    /**
     * The response status text, i.e. `"Unauthorized"`.
     */
    statusText: string;
  }) {
    super({
      ...options,
      code: 'PROVIDER_AUTHENTICATION_ERROR',
      fatal: true,
      message: `Provider authentication failed at ${options.endpoint}: ${options.status} ${options.statusText}`,
    });
  }
}

/**
 * An error that may be thrown by an integration during any step that interacts
 * with provider APIs, used to communicate an authenticated provider API client
 * resource access authorization error the user should see that can help them
 * fix a configuration problem.
 */
export class IntegrationProviderAuthorizationError extends IntegrationError {
  constructor(options: {
    /**
     * An optional reference to the error that caused this error. The cause tree
     * will be included in logging of the error to assist problem resolution.
     */
    cause?: Error;

    /**
     * The endpoint that provided the response indicating the authenticated
     * client is not authorized to access a resource.
     */
    endpoint: string;

    /**
     * The response status code, i.e. `403`, or in the case of GraphQL, whatever
     * error code provided by the response body.
     */
    status: string | number;

    /**
     * The response status text, i.e. `"Forbidden"`.
     */
    statusText: string;

    /**
     * The `_type` of entity/relationship data that could not be obtained due to
     * the authorization error.
     */
    resourceType?: string[];
  }) {
    super({
      ...options,
      code: 'PROVIDER_AUTHORIZATION_ERROR',
      fatal: false,
      message: `Provider authorization failed at ${options.endpoint}: ${options.status} ${options.statusText}`,
    });
  }
}

/**
 * An error that may be thrown by an integration during any step that interacts
 * with provider APIs, used to communicate an unexpected provider API error the
 * user should see that may help them obtain support from the provider.
 */
export class IntegrationProviderAPIError extends IntegrationError {
  constructor(options: {
    /**
     * An optional reference to the error that caused this error. The cause tree
     * will be included in logging of the error to assist problem resolution.
     */
    cause?: Error;

    /**
     * The endpoint that provided the unexpected error response.
     */
    endpoint: string;

    /**
     * The response status code, i.e. `500`, or in the case of GraphQL, whatever
     * error code provided by the response body.
     */
    status: string | number;

    /**
     * The response status text, i.e. `"Internal Server Error"`.
     */
    statusText: string;
  }) {
    super({
      ...options,
      code: 'PROVIDER_API_ERROR',
      fatal: false,
      message: `Provider API failed at ${options.endpoint}: ${options.status} ${options.statusText}`,
    });
  }
}
