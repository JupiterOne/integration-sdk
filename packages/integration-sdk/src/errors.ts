export const UNEXPECTED_ERROR_CODE = 'UNEXPECTED_ERROR';
export const UNEXPECTED_ERROR_REASON =
  'Unexpected error occurred executing integration! Please contact us in Slack or at https://support.jupiterone.io if the problem continues to occur.';

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
