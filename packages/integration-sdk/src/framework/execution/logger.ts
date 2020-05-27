import Logger from 'bunyan';
import PromiseQueue from 'p-queue';
import { v4 as uuid } from 'uuid';

import {
  IntegrationError,
  UNEXPECTED_ERROR_CODE,
  UNEXPECTED_ERROR_REASON,
} from '../../errors';
import { SynchronizationJob } from '../synchronization';
import {
  IntegrationInstance,
  IntegrationInstanceConfigFieldMap,
  IntegrationLogger,
  StepMetadata,
  LoggerSynchronizationJobContext,
  IntegrationLoggerFunctions,
  ExecutionContext,
  StepExecutionContext,
  InvocationConfig,
  IntegrationExecutionContext,
  IntegrationStepExecutionContext,
  IntegrationInvocationConfig,
} from './types';

// eslint-disable-next-line
const bunyanFormat = require('bunyan-format');

interface CreateLoggerInput<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
> {
  name: string;
  invocationConfig?: InvocationConfig<TExecutionContext, TStepExecutionContext>;
  pretty?: boolean;
  serializers?: Logger.Serializers;
}

interface CreateIntegrationLoggerInput
  extends CreateLoggerInput<
    IntegrationExecutionContext,
    IntegrationStepExecutionContext
  > {
  invocationConfig?: IntegrationInvocationConfig;
}

export function createLogger<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
>({
  name,
  pretty,
  serializers,
}: CreateLoggerInput<
  TExecutionContext,
  TStepExecutionContext
>): IntegrationLogger {
  const loggerConfig: Logger.LoggerOptions = {
    name,
    level: (process.env.LOG_LEVEL || 'info') as Logger.LogLevel,
    serializers: {
      err: Logger.stdSerializers.err,
    },
  };

  if (pretty) {
    loggerConfig.streams = [{ stream: bunyanFormat({ outputMode: 'short' }) }];
  }

  const logger = Logger.createLogger(loggerConfig);

  if (serializers) {
    logger.addSerializers(serializers);
  }

  // NOTE: concurrency is set to one to allow for logs to be published in
  // the order that they are added to the queue.
  //
  // Optimizations can come later once the synchronization api supports
  // accepting a timestamp.
  const eventPublishingQueue = new PromiseQueue({ concurrency: 1 });
  const errorSet = new Set<Error>();

  const verboseTraceLogger = instrumentVerboseTrace(logger);

  return instrumentEventLogging(
    instrumentErrorTracking(verboseTraceLogger, errorSet),
    {
      eventPublishingQueue,
      errorSet,
    },
  );
}

/**
 * Create a logger for the integration that will include invocation details and
 * serializers common to all integrations.
 */
export function createIntegrationLogger({
  name,
  invocationConfig,
  pretty,
  serializers,
}: CreateIntegrationLoggerInput): IntegrationLogger {
  const serializeInstanceConfig = createInstanceConfigSerializer(
    invocationConfig?.instanceConfigFields,
  );

  return createLogger({
    name,
    pretty,
    serializers: {
      integrationInstanceConfig: serializeInstanceConfig,
      // since config is serializable from
      instance: (instance: IntegrationInstance) => ({
        ...instance,
        config: instance.config
          ? serializeInstanceConfig(instance.config)
          : undefined,
      }),
      ...serializers,
    },
  });
}

function createInstanceConfigSerializer(
  fields?: IntegrationInstanceConfigFieldMap,
) {
  return (config: any) => {
    if (!config) {
      return config;
    } else {
      const serialized: any = {};
      for (const k of Object.keys(config)) {
        const field = fields && fields[k];
        if (field) {
          serialized[k] = field.mask
            ? `****${config[k].substr(-4)}`
            : config[k];
        } else {
          serialized[k] = '***';
        }
      }
      return serialized;
    }
  };
}

function instrumentVerboseTrace(logger: Logger): Logger {
  const trace = logger.trace;
  const child = logger.child;

  Object.assign(logger, {
    trace: (...params: any[]) => {
      if (params.length === 0) {
        return trace.apply(logger);
      }

      let additionalFields: Record<string, any> = {};
      let remainingArgs: any[] = params;
      if (params[0] instanceof Error) {
        additionalFields = { err: params[0] };
        remainingArgs = params.slice(1);
      } else if (typeof params[0] === 'object') {
        additionalFields = params[0];
        remainingArgs = params.slice(1);
      }

      trace.apply(logger, [
        { verbose: true, ...additionalFields },
        ...remainingArgs,
      ]);
    },

    child: (options: object = {}, simple?: boolean) => {
      const c = child.apply(logger, [options, simple]);
      return instrumentVerboseTrace(c);
    },
  });

  return logger;
}

function instrumentErrorTracking(logger: Logger, errorSet: Set<Error>): Logger {
  const error = logger.error;
  const child = logger.child;

  Object.assign(logger, {
    error: (...params: any[]) => {
      if (params.length === 0) {
        return error.apply(logger);
      }

      if (params[0] instanceof Error) {
        errorSet.add(params[0]);
      } else if (params[0]?.err instanceof Error) {
        errorSet.add(params[0].err);
      }

      error.apply(logger, [...params]);
    },

    child: (options: object = {}, simple?: boolean) => {
      const c = child.apply(logger, [options, simple]);
      return instrumentErrorTracking(c, errorSet);
    },
  });

  return logger;
}

interface LogContext {
  eventPublishingQueue: PromiseQueue;
  errorSet: Set<Error>;
  synchronizationJobContext?: LoggerSynchronizationJobContext;
}

function instrumentEventLogging(
  logger: Logger,
  context: LogContext,
): IntegrationLogger {
  const { eventPublishingQueue, errorSet } = context;
  const child = logger.child;

  const publishEvent = (name: string, description: string) => {
    if (process.env.JUPITERONE_DISABLE_EVENT_LOGGING === 'true') {
      return;
    }

    if (context.synchronizationJobContext) {
      const { job, apiClient } = context.synchronizationJobContext;

      const event = { name, description };

      eventPublishingQueue.add(async () => {
        try {
          await apiClient.post(
            `/persister/synchronization/jobs/${job.id}/events`,
            {
              events: [event],
            },
          );
        } catch (err) {
          // It's not the end of the world if we fail to publish
          // an event
          logger.error(
            {
              err,
              event,
            },
            'Failed to publish integration event.',
          );
        }
      });
    }
  };

  const createChildLogger = (options: object = {}, simple?: boolean) => {
    const childLogger = child.apply(logger, [options, simple]);
    return instrumentEventLogging(childLogger, context);
  };

  const integrationLoggerFunctions: IntegrationLoggerFunctions = {
    flush: async () => {
      await eventPublishingQueue.onIdle();
    },

    registerSynchronizationJobContext: (
      synchronizationJobContext: LoggerSynchronizationJobContext,
    ) => {
      context.synchronizationJobContext = synchronizationJobContext;
      const { job } = synchronizationJobContext;

      return createChildLogger({
        synchronizationJobId: job.id,
        integrationJobId: job.integrationJobId,
        integrationInstanceId: job.integrationInstanceId,
      });
    },

    isHandledError: (err: Error) => errorSet.has(err),

    stepStart: (step: StepMetadata) => {
      const name = 'step_start';
      const description = `Starting step "${step.name}"...`;
      logger.info({ step: step.id }, description);

      publishEvent(name, description);
    },
    stepSuccess: (step: StepMetadata) => {
      const name = 'step_end';
      const description = `Completed step "${step.name}".`;
      logger.info({ step: step.id }, description);

      publishEvent(name, description);
    },
    stepFailure: (step: StepMetadata, err: Error) => {
      const name = 'step_failure';
      const { errorId, description } = createErrorEventDescription(
        err,
        `Step "${step.name}" failed to complete due to error.`,
      );

      logger.error({ errorId, err, step: step.id }, description);

      publishEvent(name, description);
    },
    synchronizationUploadStart: (job: SynchronizationJob) => {
      const name = 'sync_upload_start';
      const description = 'Uploading collected data for synchronization...';
      logger.info(
        {
          synchronizationJobId: job.id,
        },
        description,
      );

      publishEvent(name, description);
    },
    synchronizationUploadEnd: (job: SynchronizationJob) => {
      const name = 'sync_upload_end';
      const description = 'Upload complete.';
      logger.info(
        {
          synchronizationJobId: job.id,
        },
        description,
      );

      publishEvent(name, description);
    },
    validationFailure: (err: Error) => {
      const name = 'validation_failure';
      const { errorId, description } = createErrorEventDescription(
        err,
        `Error occurred while validating integration configuration.`,
      );

      logger.error({ errorId, err }, description);
      publishEvent(name, description);
    },

    publishEvent(options) {
      return publishEvent(options.name, options.description);
    },

    publishErrorEvent(options) {
      const {
        name,
        message,
        err,

        // `logData` is only logged (it is used to log data that should
        // not be shown to customer but might be helpful for troubleshooting)
        logData,

        // `eventData` is added to error description but not logged
        eventData,
      } = options;
      const { errorId, description } = createErrorEventDescription(
        err,
        message,
        eventData,
      );

      logger.error({ ...logData, errorId, err }, description);
      publishEvent(name, description);
    },
  };

  return Object.assign(logger, {
    ...integrationLoggerFunctions,
    child: createChildLogger,
  });
}

type NameValuePair = [string, any];

export function createErrorEventDescription(
  err: Error | IntegrationError,
  message: string,

  /**
   * Optional data that will be added as name/value pairs to the
   * event description.
   */
  eventData?: object,
) {
  const errorId = uuid();

  let errorCode: string;
  let errorReason: string;

  if (err instanceof IntegrationError) {
    errorCode = err.code;
    errorReason = err.message;
  } else {
    errorCode = UNEXPECTED_ERROR_CODE;
    errorReason = UNEXPECTED_ERROR_REASON;
  }

  const nameValuePairs: NameValuePair[] = [
    ['errorCode', errorCode],
    ['errorId', errorId],
    ['reason', errorReason],
  ];

  if (eventData) {
    for (const key of Object.keys(eventData)) {
      nameValuePairs.push([key, eventData[key]]);
    }
  }

  const errorDetails = nameValuePairs
    .map((nameValuePair) => {
      return `${nameValuePair[0]}=${JSON.stringify(nameValuePair[1])}`;
    })
    .join(', ');

  return {
    errorId,
    description: `${message} (${errorDetails})`,
  };
}
