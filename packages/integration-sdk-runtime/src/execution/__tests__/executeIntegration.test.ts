import { promises as fs } from 'fs';
import { vol } from 'memfs';
import path from 'path';

import { getRootStorageDirectory, readJsonFromPath } from '../../fileSystem';
import {
  executeIntegrationInstance,
  executeIntegrationLocally,
  ExecuteIntegrationResult,
} from '../executeIntegration';
import { LOCAL_INTEGRATION_INSTANCE } from '../instance';
import {
  createIntegrationLogger,
  IntegrationLogger as IntegrationLoggerImpl,
} from '../../logger';
import {
  IntegrationLogger,
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationInvocationConfig,
  StepResultStatus,
  IntegrationInvocationValidationFunction,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk-core';

jest.mock('fs');

afterEach(() => {
  vol.reset();
  delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
});

describe('executeIntegrationInstance', () => {
  let validateInvocation: IntegrationInvocationValidationFunction;
  let instance: IntegrationInstance;
  let invocationConfig: IntegrationInvocationConfig;
  let logger: IntegrationLogger;

  const execute = () =>
    executeIntegrationInstance(logger, instance, invocationConfig);

  beforeEach(() => {
    validateInvocation = jest.fn();

    instance = LOCAL_INTEGRATION_INSTANCE;

    invocationConfig = {
      validateInvocation,
      integrationSteps: [],
    };

    logger = createIntegrationLogger({
      name: 'integration-name',
      invocationConfig,
    });
  });

  test('executes validateInvocation function if provided in config', async () => {
    await execute();

    const expectedContext: IntegrationExecutionContext = {
      instance,
      logger,
    };

    expect(validateInvocation).toHaveBeenCalledWith(expectedContext);
  });

  test('logs validation error if validation fails', async () => {
    const error = new IntegrationValidationError(
      'Failed to auth with provider',
    );
    invocationConfig.validateInvocation = jest.fn().mockRejectedValue(error);

    const validationFailureSpy = jest.spyOn(logger, 'validationFailure');

    await expect(execute()).rejects.toThrow(/Failed to auth with provider/);

    expect(validationFailureSpy).toHaveBeenCalledTimes(1);
    expect(validationFailureSpy).toHaveBeenCalledWith(error);
  });

  test('throws validation errors on invalid output of getStepStartStates', async () => {
    invocationConfig.getStepStartStates = jest.fn().mockReturnValue({});
    invocationConfig.integrationSteps = [
      {
        id: 'my-step',
        name: 'My awesome step',
        types: ['test'],
        executionHandler: jest.fn(),
      },
    ];
    const validationFailureSpy = jest.spyOn(logger, 'validationFailure');

    await expect(execute()).rejects.toThrow(/Start states not found for/);

    // This error is not one the user can fix, we just crash
    expect(validationFailureSpy).not.toHaveBeenCalled();
  });

  test('returns integration step results and metadata about partial datasets', async () => {
    invocationConfig = {
      ...invocationConfig,
      integrationSteps: [
        {
          id: 'my-step',
          name: 'My awesome step',
          types: ['test'],
          executionHandler: jest.fn(),
        },
      ],
    };

    await expect(execute()).resolves.toEqual({
      integrationStepResults: [
        {
          id: 'my-step',
          name: 'My awesome step',
          declaredTypes: ['test'],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
      ],
      metadata: {
        partialDatasets: {
          types: [],
        },
      },
    });
  });

  test('populates partialDatasets type for failed steps', async () => {
    invocationConfig = {
      ...invocationConfig,
      integrationSteps: [
        {
          id: 'my-step',
          name: 'My awesome step',
          types: ['test'],
          executionHandler: jest
            .fn()
            .mockRejectedValue(new Error('something broke')),
        },
      ],
    };

    await expect(execute()).resolves.toEqual({
      integrationStepResults: [
        {
          id: 'my-step',
          name: 'My awesome step',
          declaredTypes: ['test'],
          encounteredTypes: [],
          status: StepResultStatus.FAILURE,
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['test'],
        },
      },
    });
  });

  test('includes types for partially successful steps steps in partial datasets', async () => {
    invocationConfig = {
      ...invocationConfig,
      integrationSteps: [
        {
          id: 'my-step-a',
          name: 'My awesome step',
          types: ['test_a'],
          executionHandler: jest
            .fn()
            .mockRejectedValue(new Error('something broke')),
        },
        {
          id: 'my-step-b',
          name: 'My awesome step',
          types: ['test_b'],
          dependsOn: ['my-step-a'],
          executionHandler: jest.fn(),
        },
      ],
    };

    await expect(execute()).resolves.toEqual({
      integrationStepResults: [
        {
          id: 'my-step-a',
          name: 'My awesome step',
          declaredTypes: ['test_a'],
          encounteredTypes: [],
          status: StepResultStatus.FAILURE,
        },
        {
          id: 'my-step-b',
          name: 'My awesome step',
          declaredTypes: ['test_b'],
          encounteredTypes: [],
          dependsOn: ['my-step-a'],
          status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['test_a', 'test_b'],
        },
      },
    });
  });

  test('does not include partial data sets for disabled steps', async () => {
    invocationConfig = {
      ...invocationConfig,
      getStepStartStates: () => ({
        'my-step-b': { disabled: true },
        'my-step-a': { disabled: false },
      }),
      integrationSteps: [
        {
          id: 'my-step-a',
          name: 'My awesome step',
          types: ['test_a'],
          executionHandler: jest
            .fn()
            .mockRejectedValue(new Error('something broke')),
        },
        {
          id: 'my-step-b',
          name: 'My awesome step',
          types: ['test_b'],
          executionHandler: jest.fn(),
        },
      ],
    };

    await expect(execute()).resolves.toEqual({
      integrationStepResults: [
        {
          id: 'my-step-a',
          name: 'My awesome step',
          declaredTypes: ['test_a'],
          encounteredTypes: [],
          status: StepResultStatus.FAILURE,
        },
        {
          id: 'my-step-b',
          name: 'My awesome step',
          declaredTypes: ['test_b'],
          encounteredTypes: [],
          status: StepResultStatus.DISABLED,
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['test_a'],
        },
      },
    });
  });

  test('clears out the storage directory prior to performing collection', async () => {
    const previousContentFilePath = path.resolve(
      getRootStorageDirectory(),
      'graph',
      'my-test',
      'someFile.json',
    );

    vol.fromJSON({
      [previousContentFilePath]: '{ "entities": [] }',
    });

    invocationConfig = {
      ...invocationConfig,
      integrationSteps: [
        {
          id: 'my-step',
          name: 'My awesome step',
          types: ['test'],
          async executionHandler({ jobState }) {
            await jobState.addEntity({
              _key: 'test',
              _type: 'test',
              _class: 'Test',
            });
          },
        },
      ],
    };

    await execute();

    // file should no longer exist
    await expect(fs.readFile(previousContentFilePath)).rejects.toThrow(
      /ENOENT/,
    );

    // should still have written data to disk
    const files = await fs.readdir(getRootStorageDirectory());
    expect(files).toHaveLength(3);
    expect(files).toEqual(
      expect.arrayContaining(['graph', 'index', 'summary.json']),
    );

    // files should not exist any more
    await expect(fs.readFile(previousContentFilePath)).rejects.toThrow(
      /ENOENT/,
    );
  });

  test('writes results to summary.json in storage directory', async () => {
    invocationConfig = {
      ...invocationConfig,
      integrationSteps: [
        {
          id: 'my-step',
          name: 'My awesome step',
          types: ['test'],
          executionHandler: jest.fn(),
        },
        {
          id: 'my-step-2',
          name: 'My awesome second step',
          types: ['test_2'],
          executionHandler: jest
            .fn()
            .mockRejectedValue(new Error('something went wrong')),
        },
      ],
    };

    const expectedResults = {
      integrationStepResults: [
        {
          id: 'my-step',
          name: 'My awesome step',
          declaredTypes: ['test'],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'my-step-2',
          name: 'My awesome second step',
          declaredTypes: ['test_2'],
          encounteredTypes: [],
          status: StepResultStatus.FAILURE,
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['test_2'],
        },
      },
    };

    await expect(execute()).resolves.toEqual(expectedResults);

    const writtenSummary = await readJsonFromPath<ExecuteIntegrationResult>(
      path.resolve(getRootStorageDirectory(), 'summary.json'),
    );

    expect(writtenSummary).toEqual(expectedResults);
  });

  test('throws error if duplicate key is found within same step', async () => {
    invocationConfig = {
      ...invocationConfig,
      integrationSteps: [
        {
          id: 'a',
          name: 'a',
          types: [],
          async executionHandler({ jobState }) {
            await jobState.addEntities([
              {
                _key: 'key_a',
                _type: 'duplicate_entity',
                _class: 'DuplicateEntity',
              },
              {
                _key: 'key_a',
                _type: 'duplicate_entity',
                _class: 'DuplicateEntity',
              },
            ]);
          },
        },
      ],
    };

    await expect(execute()).rejects.toThrow(
      /Duplicate _key detected \(_key=key_a\)/,
    );
  });

  test('throws error if duplicate key is found across steps', async () => {
    invocationConfig = {
      ...invocationConfig,
      integrationSteps: [
        {
          id: 'a',
          name: 'a',
          types: [],
          async executionHandler({ jobState }) {
            await jobState.addEntity({
              _key: 'key_a',
              _type: 'duplicate_entity',
              _class: 'DuplicateEntity',
            });
          },
        },
        {
          id: 'b',
          name: 'b',
          types: [],
          async executionHandler({ jobState }) {
            await jobState.addEntity({
              _key: 'key_a',
              _type: 'duplicate_entity',
              _class: 'DuplicateEntity',
            });
          },
        },
      ],
    };

    await expect(execute()).rejects.toThrow(
      /Duplicate _key detected \(_key=key_a\)/,
    );
  });

  test('allows graph object schema validation to be enabled via options', async () => {
    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

    await executeIntegrationInstance(logger, instance, invocationConfig, {
      enableSchemaValidation: true,
    });

    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeDefined();
  });

  test('does not turn on schema validation if enableSchemaValidation is not set', async () => {
    await executeIntegrationInstance(logger, instance, invocationConfig);
    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();
  });
});

describe('executeIntegrationLocally', () => {
  test('provides generated logger and instance', async () => {
    const validateInvocation = jest.fn();

    await executeIntegrationLocally({
      validateInvocation,
      integrationSteps: [],
    });

    const expectedContext: IntegrationExecutionContext = {
      instance: LOCAL_INTEGRATION_INSTANCE,
      logger: expect.any(IntegrationLoggerImpl),
    };

    expect(validateInvocation).toHaveBeenCalledWith(expectedContext);
  });

  test('enables graph object schema validation', async () => {
    const validateInvocation = jest.fn();

    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

    await executeIntegrationLocally({
      validateInvocation,
      integrationSteps: [],
    });

    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeDefined();
  });
});
