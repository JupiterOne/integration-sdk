import { Writable } from 'stream';
import noop from 'lodash/noop';

import {
  createIntegrationLogger,
  createErrorEventDescription,
} from '../logger';
import Logger from 'bunyan';
import { IntegrationInvocationConfig, IntegrationStep } from '../types';
import {
  SynchronizationJobContext,
  SynchronizationJob,
} from '../../synchronization';
import { createApiClient } from '../../api';
import {
  IntegrationLocalConfigFieldMissingError,
  IntegrationValidationError,
} from '../error';
import {
  UNEXPECTED_ERROR_CODE,
  UNEXPECTED_ERROR_REASON,
  IntegrationError,
} from '../../../errors';

const invocationConfig = {} as IntegrationInvocationConfig;
const name = 'integration-logger';

describe('logger.trace', () => {
  test('includes verbose: true for downstream verbose log pruning', () => {
    const integrationLogger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    const stream = (integrationLogger as any).streams[0]
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
    const stream = (childLogger as any).streams[0].stream as Logger.RingBuffer;

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
    const logger = createIntegrationLogger({ name, invocationConfig });
    const context: SynchronizationJobContext = {
      logger,
      job: { id: 'test-job-id' } as SynchronizationJob,
      apiClient: createApiClient({
        apiBaseUrl: 'https://api.us.jupiterone.io',
        account: 'mocheronis',
      }),
    };

    logger.registerSynchronizationJobContext(context);

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation(noop as any);

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

    await logger.flush();

    const expectedEventsUrl =
      '/persister/synchronization/jobs/test-job-id/events';

    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(postSpy).toHaveBeenNthCalledWith(1, expectedEventsUrl, {
      events: [{ name: 'step_start', description: 'Starting step "Mochi"...' }],
    });
    expect(postSpy).toHaveBeenNthCalledWith(2, expectedEventsUrl, {
      events: [{ name: 'step_end', description: 'Completed step "Mochi".' }],
    });
    expect(postSpy).toHaveBeenNthCalledWith(3, expectedEventsUrl, {
      events: [
        {
          name: 'step_failure',
          description: expect.stringMatching(
            new RegExp(
              `Step "Mochi" failed to complete due to error. \\(errorCode="${error.code}", errorId="(.*)"\\)$`,
            ),
          ),
        },
      ],
    });
  });
});

describe('sync upload logging', () => {
  test('posts events to api client', async () => {
    const logger = createIntegrationLogger({ name, invocationConfig });
    const context: SynchronizationJobContext = {
      logger,
      job: { id: 'test-job-id' } as SynchronizationJob,
      apiClient: createApiClient({
        apiBaseUrl: 'https://api.us.jupiterone.io',
        account: 'mocheronis',
      }),
    };

    logger.registerSynchronizationJobContext(context);

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation(noop as any);

    logger.synchronizationUploadStart(context.job);
    logger.synchronizationUploadEnd(context.job);

    await logger.flush();

    const expectedEventsUrl =
      '/persister/synchronization/jobs/test-job-id/events';

    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(postSpy).toHaveBeenNthCalledWith(1, expectedEventsUrl, {
      events: [
        {
          name: 'sync_upload_start',
          description: 'Uploading collected data for synchronization...',
        },
      ],
    });
    expect(postSpy).toHaveBeenNthCalledWith(2, expectedEventsUrl, {
      events: [{ name: 'sync_upload_end', description: 'Upload complete.' }],
    });
  });
});

describe('validation failure logging', () => {
  test('publishes message to synchronizer and writes error log', async () => {
    const logger = createIntegrationLogger({ name, invocationConfig });
    const context: SynchronizationJobContext = {
      logger,
      job: { id: 'test-job-id' } as SynchronizationJob,
      apiClient: createApiClient({
        apiBaseUrl: 'https://api.us.jupiterone.io',
        account: 'mocheronis',
      }),
    };

    logger.registerSynchronizationJobContext(context);

    const errorSpy = jest.spyOn(logger, 'error');
    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation(noop as any);

    const error = new IntegrationValidationError('Bad Mochi');
    logger.validationFailure(error);
    await logger.flush();

    const expectedDescriptionRegex = new RegExp(
      `Error occurred while validating integration configuration. \\(errorCode="${error.code}", errorId="(.*)", reason="Bad Mochi"\\)$`,
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      { errorId: expect.any(String), err: error },
      expect.stringMatching(expectedDescriptionRegex),
    );

    const expectedEventsUrl =
      '/persister/synchronization/jobs/test-job-id/events';

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenNthCalledWith(1, expectedEventsUrl, {
      events: [
        {
          name: 'validation_failure',
          description: expect.stringMatching(expectedDescriptionRegex),
        },
      ],
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
    const logger = createIntegrationLogger({ name, invocationConfig });
    const context: SynchronizationJobContext = {
      logger,
      job: { id: 'test-job-id' } as SynchronizationJob,
      apiClient: createApiClient({
        apiBaseUrl: 'https://api.us.jupiterone.io',
        account: 'mocheronis',
      }),
    };

    const expectedEventsUrl =
      '/persister/synchronization/jobs/test-job-id/events';

    logger.registerSynchronizationJobContext(context);

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation(noop as any);

    logger.publishEvent({
      name: 'the name',
      description: 'the description',
    });

    await logger.flush();

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenNthCalledWith(1, expectedEventsUrl, {
      events: [{ name: 'the name', description: 'the description' }],
    });
  });
});

describe('#publishErrorEvent', () => {
  test('should support publishErrorEvent(...) function', async () => {
    const logger = createIntegrationLogger({ name, invocationConfig });
    const context: SynchronizationJobContext = {
      logger,
      job: { id: 'test-job-id' } as SynchronizationJob,
      apiClient: createApiClient({
        apiBaseUrl: 'https://api.us.jupiterone.io',
        account: 'mocheronis',
      }),
    };

    const expectedEventsUrl =
      '/persister/synchronization/jobs/test-job-id/events';

    logger.registerSynchronizationJobContext(context);

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation(noop as any);

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

    await logger.flush();

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenNthCalledWith(1, expectedEventsUrl, {
      events: [
        {
          name: errorEvent.name,
          description: expect.stringMatching(
            new RegExp(
              `^${errorEvent.message} \\(errorCode="${fakeError.code}", errorId="[^\\)]+", reason="${fakeError.message}", somethingExtra="${errorEvent.eventData.somethingExtra}"\\)$`,
            ),
          ),
        },
      ],
    });
  });
});
