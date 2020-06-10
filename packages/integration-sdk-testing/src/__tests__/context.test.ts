import noop from 'lodash/noop';

import {
  Entity,
  Relationship,
  IntegrationStep,
  IntegrationInstanceConfigFieldMap,
} from '@jupiterone/integration-sdk-core';

import {
  LOCAL_INTEGRATION_INSTANCE,
  SynchronizationJobContext,
} from '@jupiterone/integration-sdk-runtime';

import {
  loadProjectStructure,
  restoreProjectStructure,
} from '@jupiterone/integration-sdk-private-test-utils';

import {
  createMockExecutionContext,
  createMockStepExecutionContext,
} from '../context';
import { noopAsync } from '../logger';
import { v4 as uuid } from 'uuid';

interface Config {
  myBooleanConfig: boolean;
  myStringConfig: string;
  myTypelessConfig: string;
}

const instanceConfigFields: IntegrationInstanceConfigFieldMap = {
  myBooleanConfig: {
    type: 'boolean',
  },
  myStringConfig: {
    type: 'string',
  },
  myTypelessConfig: {},
};

/**
 * Ensure that both createMockExecutionContext and
 * createMockStepExecutionContext functions return
 * an integration logger and instance.
 *
 * Also ensure that they can accept the `instanceConfig` option.
 */
[createMockExecutionContext, createMockStepExecutionContext].forEach(
  (createContext: Function) => {
    describe(createContext.name, () => {
      afterEach(() => {
        delete process.env.MY_BOOLEAN_CONFIG;
        delete process.env.MY_STRING_CONFIG;
        delete process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID;
        restoreProjectStructure();
      });

      test('generates an execution context with a fake logger', () => {
        const { logger } = createContext({ instanceConfigFields });

        Object.keys(logger).forEach((key) => {
          if (key !== 'child' && key !== 'flush' && key !== 'isHandledError') {
            expect(logger[key]).toEqual(noop);
          }
        });

        expect(logger.child({})).toEqual(logger);
      });

      test('generates an execution context with the integration instance used for local development', () => {
        const { instance } = createContext();
        expect(instance).toEqual(LOCAL_INTEGRATION_INSTANCE);
      });

      test('generates an execution context with the integration instance used for local development with custom account id from environment variable', () => {
        const accountId = (process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID = uuid());
        const { instance } = createContext();
        expect(instance).toEqual({
          ...LOCAL_INTEGRATION_INSTANCE,
          accountId,
        });
      });

      test('accepts an instanceConfig for prepopulating configuration values', () => {
        const config = { test: true };
        const { instance } = createContext({ instanceConfig: config });
        expect(instance).toEqual({ ...LOCAL_INTEGRATION_INSTANCE, config });
      });

      test('loads instance config values if .env is present', () => {
        loadProjectStructure('typeScriptProject');

        const { instance } = createContext({
          instanceConfigFields: {
            myConfig: {
              type: 'boolean',
            },
          },
        });
        expect(instance).toEqual({
          ...LOCAL_INTEGRATION_INSTANCE,
          config: {
            myConfig: false,
          },
        });
      });

      test('generates instance config with fake values if unable to populate config with env values', () => {
        loadProjectStructure('instanceConfigWithoutEnv');

        const { instance } = createContext({ instanceConfigFields });
        expect(instance).toEqual({
          ...LOCAL_INTEGRATION_INSTANCE,
          config: {
            myBooleanConfig: true,
            myStringConfig: 'STRING_VALUE',
            myTypelessConfig: 'STRING_VALUE',
          },
        });
      });
    });
  },
);

describe('createMockExecutionContext', () => {
  test('accepts generic for typed instance config', () => {
    const { instance } = createMockExecutionContext<Config>({
      instanceConfigFields,
    });

    expect(instance.config.myTypelessConfig).toBeDefined();
    expect(instance.config.myStringConfig).toBeDefined();
    expect(instance.config.myBooleanConfig).toBeDefined();
  });
});

describe('createMockStepExecutionContext', () => {
  test('accepts generic for typed instance config', () => {
    const { instance } = createMockStepExecutionContext<Config>({
      instanceConfigFields,
    });

    expect(instance.config.myTypelessConfig).toBeDefined();
    expect(instance.config.myStringConfig).toBeDefined();
    expect(instance.config.myBooleanConfig).toBeDefined();
  });

  test('accepts entities and relationships to initialize job state with', async () => {
    const entities: Entity[] = [
      {
        _key: 'test',
        _type: 'test_entity',
        _class: 'Resource',
      },
    ];

    const relationships: Relationship[] = [
      {
        _key: 'a|has|b',
        _type: 'test_relationship',
        _class: 'HAS',
        _fromEntityKey: 'a',
        _toEntityKey: 'b',
      },
    ];

    const { jobState } = createMockStepExecutionContext({
      instanceConfigFields,
    });

    jobState.addEntities(entities);
    jobState.addRelationships(relationships);

    expect(jobState.collectedEntities).toEqual(entities);
    expect(jobState.collectedRelationships).toEqual(relationships);
  });

  test('throws error if duplicate key is added', () => {
    const entities: Entity[] = [
      {
        _key: 'test',
        _type: 'test_entity',
        _class: 'Resource',
      },
      {
        _key: 'test',
        _type: 'test_entity',
        _class: 'Resource',
      },
    ];
    const { jobState } = createMockStepExecutionContext({
      instanceConfigFields,
    });

    expect(jobState.addEntities(entities)).rejects.toThrow(
      /Duplicate _key detected \(_key=test\)/,
    );
  });

  test('fits into the integration step interface', async () => {
    expect.assertions(0);

    const step: IntegrationStep = {
      id: 'step-a',
      name: 'My step',
      types: [],
      executionHandler() {
        return Promise.resolve();
      },
    };

    const context = createMockStepExecutionContext({ instanceConfigFields });
    await step.executionHandler(context);
  });

  test('tracks encounteredTypes', () => {
    const { jobState } = createMockStepExecutionContext({
      instanceConfigFields,
    });

    jobState.addEntity({
      _key: 'entity:0',
      _type: 'test_entity',
      _class: 'Resource',
    });

    jobState.addRelationship({
      _key: 'relationship:0',
      _type: 'test_relationship',
      _class: 'Resource',
      _fromEntityKey: 'a',
      _toEntityKey: 'b',
    });

    expect(jobState.encounteredTypes).toEqual([
      'test_entity',
      'test_relationship',
    ]);
  });
});
