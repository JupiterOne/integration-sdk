import { StepMetadata } from './';
import { SynchronizationJob } from './synchronization';

export interface IntegrationEvent {
  name: string;
  description: string;
}

interface LogFunction {
  (...args: any[]): boolean | void;
}

interface ChildLogFunction {
  (options: object): IntegrationLogger;
}

type StepLogFunction = (step: StepMetadata) => void;
type StepLogFunctionWithError = (step: StepMetadata, err: Error) => void;
type SynchronizationLogFunction = (job: SynchronizationJob) => void;
type ValidationLogFunction = (err: Error) => void;
type IsHandledErrorFunction = (err: Error) => boolean;

type PublishEventInput = {
  name: string;
  description: string;
};

type PublishEventFunction = (options: PublishEventInput) => void;

type PublishErrorEventInput = {
  /**
   * A name to associate with error
   */
  name: string;

  message: string;

  /**
   * The raw error that occurred
   */
  err: Error;

  /**
   * Any additional data that will only be logged (not published with event)
   */
  logData?: object;

  /**
   * Contents of `eventData` will be serialized and added to the description
   * property of the event but it will not be logged.
   */
  eventData?: object;
};

type PublishErrorEventFunction = (options: PublishErrorEventInput) => void;

interface BaseLogger {
  // traditional functions for regular logging
  trace: LogFunction;
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  fatal: LogFunction;
  child: ChildLogFunction;
}

export interface IntegrationLoggerFunctions {
  isHandledError: IsHandledErrorFunction;

  // Special log functions used to publish events to j1
  stepStart: StepLogFunction;
  stepSuccess: StepLogFunction;
  stepFailure: StepLogFunctionWithError;
  synchronizationUploadStart: SynchronizationLogFunction;
  synchronizationUploadEnd: SynchronizationLogFunction;
  validationFailure: ValidationLogFunction;

  on(
    eventName: 'event',
    listener: (event: IntegrationEvent) => void,
  ): IntegrationLogger;

  /**
   * @deprecated
   */
  publishEvent: PublishEventFunction;

  /**
   * @deprecated
   */
  publishErrorEvent: PublishErrorEventFunction;
}

export type IntegrationLogger = BaseLogger & IntegrationLoggerFunctions;
