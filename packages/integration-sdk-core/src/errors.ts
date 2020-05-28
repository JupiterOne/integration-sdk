export const UNEXPECTED_ERROR_CODE = 'UNEXPECTED_ERROR';
export const UNEXPECTED_ERROR_REASON =
  'Unexpected error occurred executing integration! Please contact us in Slack or at https://support.jupiterone.io if the problem continues to occur.';

export const PROVIDER_AUTH_ERROR_DESCRIPTION =
  ' Failed to access provider resource.' +
  ' This integration is likely misconfigured or has insufficient permissions required to access the resource.' +
  " Please ensure your integration's configuration settings are set up correctly.";

export interface IntegrationErrorOptions {
  message: string;

  /**
   * A code associated with the error. This should take the form
   * `SOMETHING_LIKE_THE_CLASS_ERROR`, ending with `_ERROR` an having a name
   * similar to the class of the error type.
   */
  code: string;

  /**
   * An optional flag used to mark the error as fatal. A fatal error will stop
   *
   * execution of the entire integration.
   */
  fatal?: boolean;

  /**
   * An optional reference to the error that caused this error. The cause tree
   * will be included in logging of the error to assist problem resolution.
   */
  cause?: Error;
}

/**
 * The base type of errors generated during integration execution. Integrations
 * should not throw this error type directly; use one of the types documented
 * below.
 *
 * All errors occurring during execution of an integration should ultimately end
 * up as an `IntegrationError`, or a subclass thereof, each expressing a `code`
 * reflecting the class of the error. In cases when an unhandled `Error` occurs,
 * which has no `code`, then `"UNEXPECTED_ERROR"` will be used in logging the
 * error.
 *
 * Integrations generally need to throw errors in only a few cases:
 *
 * 1. `IntegrationProviderAuthenticationError` - during `validateInvocation`,
 *    when an attempt to authenticate with the provider has failed.
 * 1. `IntegrationValidationError` - during `validateInvocation`, when the
 *    configuration is considered invalid in some way.
 * 1. `IntegrationProviderAuthorizationError` - during requests to the provider
 *    API and a `403 Forbidden` or similar response is provided.
 * 1. `IntegrationProviderAPIError` - during requests to the provider API and an
 *    unexpected response is provided.
 * 1. `Error` - any unexpected error should not be caught in the integration;
 *    the step execution system will catch and report it.
 *
 * The integration may catch errors, but they should not be considered terminal
 * when it does, and the `catch` block should call `logger.warn({err: error },
 * "Message for production analysis")`. For example:
 *
 * ```ts
 * try {
 *   // something that could go wrong, but it is handled by the integration
 * } catch (error) {
 *   // log it for production analysis, but carry on because we know what we're doing
 *   logger.warn({ err: error }, "Nothing we can't handle, but someone may come asking");
 * }
 * ```
 */
export class IntegrationError extends Error {
  /**
   * Optional cause associated with the error.
   */
  readonly _cause?: Error;

  /**
   * Code associated with the error.
   */
  readonly code: string;

  /**
   * Flag used to mark the error as fatal.
   */
  readonly fatal: boolean | undefined;

  constructor(options: IntegrationErrorOptions) {
    super(options.message);
    this.code = options.code;
    this.fatal = options.fatal;
    this._cause = options.cause;
  }

  /**
   * For compatibility with [bunyan err serializer](https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js#L1125).
   */
  cause() {
    return this._cause;
  }
}

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
