import { Writable } from 'stream';
import Logger from 'bunyan';

import {
  SynchronizationJob,
  IntegrationError,
  IntegrationInvocationConfig,
  IntegrationStep,
  IntegrationLocalConfigFieldMissingError,
  IntegrationValidationError,
  IntegrationProviderAuthorizationError,
  IntegrationProviderAuthenticationError,
  UNEXPECTED_ERROR_CODE,
  UNEXPECTED_ERROR_REASON,
  PROVIDER_AUTH_ERROR_DESCRIPTION,
} from '@jupiterone/integration-sdk-core';

import {
  IntegrationLogger,
  createIntegrationLogger,
  createErrorEventDescription,
} from '../../logger';

const invocationConfig = {} as IntegrationInvocationConfig;
const name = 'integration-logger';

describe('logger.trace', () => {
  test('includes verbose: true for downstream verbose log pruning', () => {
    const integrationLogger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    const stream = (integrationLogger as any)._logger.streams[0]
      .stream as Logger.RingBuffer;

    integrationLogger.trace();
    expect(stream.records).toEqual([]);

    integrationLogger.trace({ stuff: 'yo!' }, 'Me message');
    integrationLogger.trace(Error('Yo!'), 'Me message');
    integrationLogger.trace('formatit', 'Me message');

    expect(stream.records).toEqual([
      expect.objectContaining({
        stuff: 'yo!',
        verbose: true,
        msg: 'Me message',
      }),
      expect.objectContaining({
        err: expect.objectContaining({
          message: 'Yo!',
        }),
        verbose: true,
        msg: 'Me message',
      }),
      expect.objectContaining({
        verbose: true,
        msg: 'formatit Me message',
      }),
    ]);
  });

  test('logger.child.trace', () => {
    const integrationLogger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    const childLogger = integrationLogger.child({
      mostuff: 'smile',
    });
    const stream = (childLogger as any)._logger.streams[0]
      .stream as Logger.RingBuffer;

    integrationLogger.trace();
    childLogger.trace();
    expect(stream.records).toEqual([]);

    integrationLogger.trace({ stuff: 'parents right?' }, 'Dad joke');
    childLogger.trace({ stuff: 'yo!' }, 'Me message');
    expect(stream.records).toEqual([
      expect.objectContaining({
        stuff: 'parents right?',
        verbose: true,
        msg: 'Dad joke',
      }),
      expect.objectContaining({
        stuff: 'yo!',
        mostuff: 'smile',
        verbose: true,
        msg: 'Me message',
      }),
    ]);
    expect(stream.records[0].mostuff).toBeUndefined();
  });
});

describe('createIntegrationLogger', () => {
  let addSerializers: jest.Mock;

  beforeEach(() => {
    addSerializers = jest.fn();
    jest.spyOn(Logger, 'createLogger').mockReturnValue(({
      addSerializers,
    } as unknown) as Logger);
  });

  test('installs expected properties', async () => {
    createIntegrationLogger({ name, invocationConfig });

    expect(Logger.createLogger).toHaveBeenCalledWith({
      name: 'integration-logger',
      level: 'info',
      serializers: {
        err: Logger.stdSerializers.err,
      },
    });
  });

  test('allows pretty option to be specified', () => {
    createIntegrationLogger({
      name,
      invocationConfig,
      pretty: true,
    });

    expect(Logger.createLogger).toHaveBeenCalledTimes(1);
    expect(Logger.createLogger).toHaveBeenCalledWith({
      name: 'integration-logger',
      level: 'info',
      serializers: {
        err: Logger.stdSerializers.err,
      },
      streams: [{ stream: expect.any(Writable) }],
    });
  });

  test('adds provided serializers', () => {
    createIntegrationLogger({
      name,
      invocationConfig,
      serializers: {},
    });

    expect(addSerializers).toHaveBeenCalledTimes(1);
    expect(addSerializers).toHaveBeenCalledWith({
      integrationInstanceConfig: expect.any(Function),
      instance: expect.any(Function),
    });
  });

  describe('integrationInstanceConfig serializer', () => {
    test('is a function', () => {
      createIntegrationLogger({ name, invocationConfig });

      expect(addSerializers).toHaveBeenNthCalledWith(1, {
        integrationInstanceConfig: expect.any(Function),
        instance: expect.any(Function),
      });
    });

    test('handles undefined config', () => {
      createIntegrationLogger({ name, invocationConfig });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;
      expect(serializer(undefined)).toEqual(undefined);
    });

    test('handles null config', () => {
      createIntegrationLogger({ name, invocationConfig });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(serializer(null)).toEqual(null);
    });

    test('masks everything when field metadata not provided', () => {
      createIntegrationLogger({ name, invocationConfig });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(serializer({ anything: 'bob', everything: 'jane' })).toEqual({
        anything: '***',
        everything: '***',
      });
    });

    test('shows unmasked data', () => {
      createIntegrationLogger({
        name,
        invocationConfig: {
          ...invocationConfig,
          instanceConfigFields: {
            masked: {
              mask: true,
            },
            unmasked: {
              mask: false,
            },
          },
        },
      });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(
        serializer({
          anything: 'bob',
          masked: 'this is secret',
          unmasked: 'this is clear',
        }),
      ).toEqual({
        anything: '***',
        masked: '****cret',
        unmasked: 'this is clear',
      });
    });
  });
});

describe('step event publishing', () => {
  test('writes logs for stepEnd, stepStart, and stepFailure events', () => {
    const logger = createIntegrationLogger({ name, invocationConfig });

    const infoSpy = jest.spyOn(logger, 'info');
    const errorSpy = jest.spyOn(logger, 'error');

    const step: IntegrationStep = {
      id: 'a',
      name: 'Mochi',
      types: [],
      dependsOn: [],
      executionHandler: jest.fn(),
    };

    logger.stepStart(step);
    logger.stepSuccess(step);

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenNthCalledWith(
      1,
      {
        step: step.id,
      },
      `Starting step "Mochi"...`,
    );
    expect(infoSpy).toHaveBeenNthCalledWith(
      2,
      {
        step: step.id,
      },
      `Completed step "Mochi".`,
    );

    const error = new IntegrationLocalConfigFieldMissingError('ripperoni');
    logger.stepFailure(step, error);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      {
        err: error,
        errorId: expect.any(String),
        step: step.id,
      },
      expect.stringContaining(
        `Step "Mochi" failed to complete due to error. (errorCode="${error.code}"`,
      ),
    );
  });

  test('posts events via api client if synchronizationContext is registered', async () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('event', onEmitEvent);

    const step: IntegrationStep = {
      id: 'a',
      name: 'Mochi',
      types: [],
      dependsOn: [],
      executionHandler: jest.fn(),
    };

    logger.stepStart(step);
    logger.stepSuccess(step);

    // just use some error that contains a code
    const error = new IntegrationLocalConfigFieldMissingError('ripperoni');
    logger.stepFailure(step, error);

    expect(onEmitEvent).toHaveBeenCalledTimes(3);
    expect(onEmitEvent).toHaveBeenNthCalledWith(1, {
      name: 'step_start',
      description: 'Starting step "Mochi"...',
    });
    expect(onEmitEvent).toHaveBeenNthCalledWith(2, {
      name: 'step_end',
      description: 'Completed step "Mochi".',
    });
    expect(onEmitEvent).toHaveBeenNthCalledWith(3, {
      name: 'step_failure',
      description: expect.stringMatching(
        new RegExp(
          `Step "Mochi" failed to complete due to error. \\(errorCode="${error.code}", errorId="(.*)"\\)$`,
        ),
      ),
    });
  });
});

describe('provider auth error details', () => {
  const step: IntegrationStep = {
    id: 'a',
    name: 'Mochi',
    types: [],
    dependsOn: [],
    executionHandler: jest.fn(),
  };

  let onEmitEvent: jest.MockedFunction<any>;
  let logger: IntegrationLogger;

  beforeEach(() => {
    onEmitEvent = jest.fn();
    logger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    logger.on('event', onEmitEvent);
  });

  const errorDetails = {
    endpoint: 'https://cute.af',
    status: 403,
    statusText: 'Forbidden',
  };

  [
    {
      error: new IntegrationProviderAuthenticationError(errorDetails),
      expectedReason:
        'Provider authentication failed at https://cute.af: 403 Forbidden',
    },
    {
      error: new IntegrationProviderAuthorizationError(errorDetails),
      expectedReason:
        'Provider authorization failed at https://cute.af: 403 Forbidden',
    },
  ].forEach(({ error, expectedReason }) => {
    test(`stepFailure adds additional information to the log message if an ${error.code} error is provided`, async () => {
      logger.stepFailure(step, error);

      expect(onEmitEvent).toHaveBeenCalledWith({
        name: 'step_failure',
        description: expect.stringMatching(
          new RegExp(
            '^Step "Mochi" failed to complete due to error.' +
              PROVIDER_AUTH_ERROR_DESCRIPTION +
              ` \\(errorCode="${error.code}", errorId="[^"]*", reason="${expectedReason}"\\)$`,
          ),
        ),
      });
    });

    test(`validationFailure adds additional information to the log message if an ${error.code} error is provided`, async () => {
      logger.validationFailure(error);

      expect(onEmitEvent).toHaveBeenCalledWith({
        name: 'validation_failure',
        description: expect.stringMatching(
          new RegExp(
            '^Error occurred while validating integration configuration.' +
              PROVIDER_AUTH_ERROR_DESCRIPTION +
              ` \\(errorCode="${error.code}", errorId="[^"]*", reason="${expectedReason}"\\)$`,
          ),
        ),
      });
    });
  });
});

describe('sync upload logging', () => {
  test('posts events to api client', async () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    logger.on('event', onEmitEvent);

    const job = { id: 'test-job-id' } as SynchronizationJob;

    logger.synchronizationUploadStart(job);
    logger.synchronizationUploadEnd(job);

    expect(onEmitEvent).toHaveBeenCalledTimes(2);
    expect(onEmitEvent).toHaveBeenNthCalledWith(1, {
      name: 'sync_upload_start',
      description: 'Uploading collected data for synchronization...',
    });
    expect(onEmitEvent).toHaveBeenNthCalledWith(2, {
      name: 'sync_upload_end',
      description: 'Upload complete.',
    });
  });
});

describe('validation failure logging', () => {
  test('publishes message to synchronizer and writes error log', async () => {
    const onEmitEvent = jest.fn();
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    logger.on('event', onEmitEvent);

    const errorSpy = jest.spyOn(logger, 'error');

    const error = new IntegrationValidationError('Bad Mochi');
    logger.validationFailure(error);

    const expectedDescriptionRegex = new RegExp(
      `Error occurred while validating integration configuration. \\(errorCode="${error.code}", errorId="(.*)", reason="Bad Mochi"\\)$`,
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      { errorId: expect.any(String), err: error },
      expect.stringMatching(expectedDescriptionRegex),
    );

    expect(onEmitEvent).toHaveBeenCalledTimes(1);
    expect(onEmitEvent).toHaveBeenNthCalledWith(1, {
      name: 'validation_failure',
      description: expect.stringMatching(expectedDescriptionRegex),
    });
  });
});

describe('createErrorEventDescription', () => {
  test('supplies default reason if an error without a code is provided', () => {
    const error = new Error('soba');

    const { description, errorId } = createErrorEventDescription(
      error,
      'testing',
    );
    expect(description).toEqual(
      `testing (errorCode="${UNEXPECTED_ERROR_CODE}", errorId="${errorId}", reason="${UNEXPECTED_ERROR_REASON}")`,
    );
  });

  test('displays code and message from error if error is an integration error', () => {
    const error = new IntegrationValidationError('soba');

    const { description, errorId } = createErrorEventDescription(
      error,
      'testing',
    );
    expect(description).toEqual(
      `testing (errorCode="${error.code}", errorId="${errorId}", reason="soba")`,
    );
  });
});

describe('#publishEvent', () => {
  test('should support publishEvent(...) function', async () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('event', onEmitEvent);

    logger.publishEvent({
      name: 'the name',
      description: 'the description',
    });

    expect(onEmitEvent).toHaveBeenCalledTimes(1);
    expect(onEmitEvent).toHaveBeenCalledWith({
      name: 'the name',
      description: 'the description',
    });
  });
});

describe('#publishErrorEvent', () => {
  test('should support publishErrorEvent(...) function', async () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('event', onEmitEvent);

    const fakeError = new IntegrationError({
      code: 'fake code',
      message: 'fake reason',
    });

    const errorEvent = {
      name: 'the name',
      message: 'Something bad happened',
      err: fakeError,
      // `eventData` is serialized into the event description and logged
      eventData: {
        somethingExtra: 'abc',
      },
      // `logData` is not put into the event description but it is logged
      logData: {
        onlyForLogging: 'xyz',
      },
    };

    logger.publishErrorEvent(errorEvent);

    expect(onEmitEvent).toHaveBeenCalledTimes(1);
    expect(onEmitEvent).toHaveBeenCalledWith({
      name: errorEvent.name,
      description: expect.stringMatching(
        new RegExp(
          `^${errorEvent.message} \\(errorCode="${fakeError.code}", errorId="[^\\)]+", reason="${fakeError.message}", somethingExtra="${errorEvent.eventData.somethingExtra}"\\)$`,
        ),
      ),
    });
  });
});
