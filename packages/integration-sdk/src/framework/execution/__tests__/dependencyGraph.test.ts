import { promises as fs } from 'fs';
import times from 'lodash/times';
import { vol } from 'memfs';
import { v4 as uuid } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { IntegrationError } from '../../../../src/errors';
import { Entity, Relationship } from '../../types';
import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from '../dependencyGraph';
import { LOCAL_INTEGRATION_INSTANCE } from '../instance';
import { createIntegrationLogger } from '../logger';
import { getDefaultStepStartStates } from '../step';
import {
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationLogger,
  IntegrationStep,
  IntegrationStepExecutionContext,
  StepResultStatus,
  JobState,
} from '../types';

jest.mock('fs');

afterEach(() => vol.reset());

const executionContext: IntegrationExecutionContext<{}> = {
  logger: createIntegrationLogger({
    name: 'step logger',
    invocationConfig: {
      integrationSteps: [],
    },
  }),
  instance: LOCAL_INTEGRATION_INSTANCE,
};

describe('buildStepDependencyGraph', () => {
  test('should throw an error if a circular dependency is created', () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => buildStepDependencyGraph(steps)).toThrow(
      /Dependency Cycle Found/,
    );
  });

  test('should throw an error a dependency that does not exist is specified', () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['c'],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => buildStepDependencyGraph(steps)).toThrow(
      /Node does not exist/,
    );
  });

  test('should successfully construct a dependency graph given steps with unique ids and valid dependencies', () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: jest.fn(),
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    expect(graph.getNodeData('a')).toEqual(steps[0]);
    expect(graph.getNodeData('b')).toEqual(steps[1]);
    expect(graph.dependenciesOf('a')).toEqual(['b']);
  });
});

describe('executeStepDependencyGraph', () => {
  test('executionHandler should have access to "jobState", "logger", and "instance" objects', async () => {
    let jobState: JobState;
    let instance: IntegrationInstance<{}>;
    let logger: IntegrationLogger;

    const executionHandlerSpy = jest.fn(
      (context: IntegrationStepExecutionContext<{}>) => {
        jobState = context.jobState;
        instance = context.instance;
        logger = context.logger;
      },
    );

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: executionHandlerSpy,
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(executionHandlerSpy).toHaveBeenCalledTimes(1);

    expect(logger!).toBeInstanceOf(jest.requireActual('bunyan'));
    expect(instance!).toEqual(LOCAL_INTEGRATION_INSTANCE);

    // ensure job state has expected functions
    [
      'addEntities',
      'addRelationships',
      'iterateEntities',
      'iterateRelationships',
      'flush',
    ].forEach((fn) => {
      expect(jobState[fn]).toEqual(expect.any(Function));
    });
  });

  test("waits for all of a steps's dependencies to complete prior to executing", async () => {
    let resolveA;
    const spyA = jest.fn(() => {
      return new Promise<void>((resolve) => {
        resolveA = resolve;
      });
    });

    const spyB = jest.fn(() => {
      return new Promise<void>(() => {
        // never resolve
      });
    });

    const spyC = jest.fn();

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: ['my_type_a'],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: ['my_type_b'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: ['my_type_c'],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    await waitForExpect(() => {
      expect(spyA).toHaveBeenCalledTimes(1);
      expect(spyB).toHaveBeenCalledTimes(1);
    });

    resolveA();

    // spyB never resolved, so spyC should never be called
    await expect(
      waitForExpect(() => expect(spyC).toHaveBeenCalledTimes(1), 1000),
    ).rejects.toThrow();
  });

  test('logs warning if encountered types do not match declared types', async () => {
    const workingDirectory = `/test`;
    jest.spyOn(process, 'cwd').mockReturnValue(workingDirectory);

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: ['my_type_a'],
        executionHandler: async ({ jobState }) => {
          await jobState.addEntities([
            {
              _key: 'my_keys_a',
              _type: 'my_type_b',
              _class: 'MyClassA',
            },
          ]);
        },
      },
    ];

    const warnSpy = jest.spyOn(executionContext.logger, 'warn');
    jest
      .spyOn(executionContext.logger, 'child')
      .mockReturnValue(executionContext.logger);

    const graph = buildStepDependencyGraph(steps);
    const result = await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: ['my_type_a'],
        encounteredTypes: ['my_type_b'],
        status: StepResultStatus.SUCCESS,
      },
    ]);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      {
        undeclaredTypes: ['my_type_b'],
      },
      'Undeclared types were detected.',
    );
  });

  test("writes data to the correct graph directory path using each step's id", async () => {
    const workingDirectory = `/test`;
    jest.spyOn(process, 'cwd').mockReturnValue(workingDirectory);

    let entityA: Entity;
    let entityB: Entity;
    let relationship: Relationship;

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: ['my_type_a'],
        executionHandler: async ({ jobState }) => {
          await jobState.addEntities([
            {
              _key: 'my_keys_a',
              _type: 'my_type_a',
              _class: 'MyClassA',
            },
          ]);
        },
      },
      {
        id: 'b',
        name: 'b',
        types: ['my_type_b'],
        executionHandler: async ({ jobState }) => {
          await jobState.addEntities([
            {
              _key: 'my_key_b',
              _type: 'my_type_b',
              _class: 'MyClassB',
            },
          ]);
        },
      },
      {
        id: 'c',
        name: 'c',
        types: ['my_type_c'],
        dependsOn: ['a', 'b'],
        executionHandler: async ({ jobState }) => {
          await jobState.iterateEntities({ _type: 'my_type_a' }, (e) => {
            entityA = e;
          });

          await jobState.iterateEntities({ _type: 'my_type_b' }, (e) => {
            entityB = e;
          });

          relationship = {
            _key: 'my_key_c',
            _type: 'my_type_c',
            _class: 'MyClassC',
            _fromEntityKey: entityA._key,
            _toEntityKey: entityB._key,
          };
          await jobState.addRelationships([relationship]);
        },
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    const stepToDataMap = {
      [steps[0].id]: {
        type: 'entities',
        data: [entityA!],
      },
      [steps[1].id]: {
        type: 'entities',
        data: [entityB!],
      },
      [steps[2].id]: {
        type: 'relationships',
        data: [relationship!],
      },
    };

    for (const [stepId, { type, data }] of Object.entries(stepToDataMap)) {
      const directory = `${workingDirectory}/.j1-integration/graph/${stepId}/${type}`;
      const files = await fs.readdir(directory);

      // each step should have just generated one file
      expect(files).toHaveLength(1);

      // each step should have just generated one file
      const writtenData = await fs.readFile(`${directory}/${files[0]}`, 'utf8');
      expect(writtenData).toEqual(JSON.stringify({ [type]: data }, null, 2));
    }
  });

  test('should perform a flush of the jobState after a step was executed', async () => {
    let jobStateFlushSpy;

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: ({ jobState }) => {
          jobStateFlushSpy = jest.spyOn(jobState, 'flush');
        },
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(jobStateFlushSpy).toHaveBeenCalledTimes(1);
  });

  test('should hold execution of dependent steps until current step has completed', async () => {
    let resolveSpyA: Function;
    const spyA = jest.fn(
      (): Promise<void> =>
        new Promise((resolve) => {
          resolveSpyA = resolve;
        }),
    );
    const spyB = jest.fn();

    /**
     * Graph:
     * a - b
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    const executionPromise = executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    // wait for spyA to have been called
    await waitForExpect(() => {
      expect(spyA).toHaveBeenCalledTimes(1);
    });

    // ensure spyB has not been called yet
    expect(spyB).toHaveBeenCalledTimes(0);

    resolveSpyA!();

    // expect spyB to eventually be called
    await waitForExpect(() => {
      expect(spyB).toHaveBeenCalledTimes(1);
    });

    await executionPromise;
  });

  test('executes all leaf steps concurrently', async () => {
    const resolveFunctions: Function[] = [];

    const testData = times(50, () => {
      const spy = jest.fn(
        (): Promise<void> =>
          new Promise((resolve) => {
            resolveFunctions.push(resolve);
          }),
      );

      const step: IntegrationStep = {
        id: uuid(),
        name: uuid(),
        types: [],
        executionHandler: spy,
      };

      return { step, spy };
    });

    const steps = testData.map((d) => d.step);
    const spies = testData.map((d) => d.spy);

    const graph = buildStepDependencyGraph(steps);

    let executionComplete = false;
    const executionPromise = executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    ).then(() => {
      executionComplete = true;
    });

    // wait for all spies to have been called
    await waitForExpect(() => {
      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    });

    expect(executionComplete).toEqual(false);

    resolveFunctions.forEach((resolve) => resolve());

    await executionPromise;
    expect(executionComplete).toEqual(true);
  });

  test('should mark steps failed executionHandlers with status FAILURE a dependent steps with status PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn().mockRejectedValue(new Error('oops'));
    const spyC = jest.fn();

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    const result = await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );
    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: [],
        encounteredTypes: [],
        status: StepResultStatus.SUCCESS,
      },
      {
        id: 'b',
        name: 'b',
        declaredTypes: [],
        encounteredTypes: [],
        dependsOn: ['a'],
        status: StepResultStatus.FAILURE,
      },
      {
        id: 'c',
        name: 'c',
        declaredTypes: [],
        encounteredTypes: [],
        dependsOn: ['b'],
        status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
  });

  test('logs error after step fails', async () => {
    const error = new IntegrationError({
      code: 'ABC-123',
      message: 'oopsie',
    });
    let errorLogSpy;

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: ({ logger }) => {
          errorLogSpy = jest.spyOn(logger, 'error');
          throw error;
        },
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(errorLogSpy).toHaveBeenCalledTimes(1);
    expect(errorLogSpy).toHaveBeenCalledWith(
      { step: 'a', err: error, errorId: expect.any(String) },
      expect.stringMatching(
        new RegExp(
          `Step "a" failed to complete due to error. \\(errorCode="ABC-123", errorId="(.*)"\\)$`,
        ),
      ),
    );
  });

  test('steps with dependencies resulting in PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE assume the same status', async () => {
    const spyA = jest.fn().mockRejectedValue(new Error('oops'));
    const spyB = jest.fn();
    const spyC = jest.fn();

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    const result = await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );
    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: [],
        encounteredTypes: [],
        status: StepResultStatus.FAILURE,
      },
      {
        id: 'b',
        name: 'b',
        declaredTypes: [],
        encounteredTypes: [],
        dependsOn: ['a'],
        status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
      },
      {
        id: 'c',
        name: 'c',
        declaredTypes: [],
        encounteredTypes: [],
        dependsOn: ['b'],
        status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
  });

  test('should execute linear dependencyGraph in order', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
  });

  test('should handle graph steps that contain multiple dependencies', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();

    /**
     * a
     *   \
     *     c - d
     *   /
     * b
     *
     * In this situation, 'a' and 'b' are leaf nodes
     * 'c' depends on 'a' and 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        types: [],
        dependsOn: ['c'],
        executionHandler: spyD,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyC);
    expect(spyB).toHaveBeenCalledBefore(spyC);
    expect(spyC).toHaveBeenCalledBefore(spyD);
  });

  test('should execute step with multiple contributors last', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();
    const spyE = jest.fn();

    /**
     *     e
     *       \
     * a - c - d
     *       /
     *     b
     *
     * In this situation, 'a', 'e', and 'b' are leaf nodes
     * 'c' depends on 'a',
     * 'd' depends on 'e', 'c', and 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        types: [],
        dependsOn: ['b', 'c', 'e'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        types: [],
        executionHandler: spyE,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(1);
    expect(spyE).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyC);
    expect(spyB).toHaveBeenCalledBefore(spyD);
    expect(spyC).toHaveBeenCalledBefore(spyD);
    expect(spyE).toHaveBeenCalledBefore(spyD);
  });

  test('should execute steps that have shared requirements in correct order', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();
    const spyE = jest.fn();

    /**
     * a - c - e
     *   /    /
     * b  - d
     *
     * In this situation, 'a' and 'b' are leaf nodes
     * 'c' depends on 'a' and 'b'
     * 'd' depends on 'b'
     * 'e' depends on 'c' and 'd'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        types: [],
        dependsOn: ['c', 'd'],
        executionHandler: spyE,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(
      executionContext,
      graph,
      getDefaultStepStartStates(steps),
    );

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(1);
    expect(spyE).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyC);

    expect(spyB).toHaveBeenCalledBefore(spyD);
    expect(spyB).toHaveBeenCalledBefore(spyC);

    expect(spyC).toHaveBeenCalledBefore(spyE);
    expect(spyD).toHaveBeenCalledBefore(spyE);
  });

  test('does not execute step if marked as disabled', async () => {
    const spyA = jest.fn();

    /**
     *     e
     *       \
     * a - c - d
     *       /
     *     b
     *
     * In this situation, 'a', 'e', and 'b' are leaf nodes
     * 'c' depends on 'a',
     * 'd' depends on 'e', 'c', and 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    const stepStartStates = getDefaultStepStartStates(steps);
    stepStartStates['a'] = {
      disabled: true,
    };

    const result = await executeStepDependencyGraph(
      executionContext,
      graph,
      stepStartStates,
    );

    expect(spyA).toHaveBeenCalledTimes(0);

    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: [],
        encounteredTypes: [],
        status: StepResultStatus.DISABLED,
      },
    ]);
  });
  test("does not execute step and it's dependencies if marked as disabled", async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();
    const spyE = jest.fn();

    /**
     *     e
     *       \
     * a - c - d
     *       /
     *     b
     *
     * In this situation, 'a', 'e', and 'b' are leaf nodes
     * 'c' depends on 'a',
     * 'd' depends on 'e', 'c', and 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        types: [],
        dependsOn: ['b', 'c', 'e'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        types: [],
        executionHandler: spyE,
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    const stepStartStates = getDefaultStepStartStates(steps);
    stepStartStates['b'] = {
      disabled: true,
    };

    const results = await executeStepDependencyGraph(
      executionContext,
      graph,
      stepStartStates,
    );

    expect(results).toEqual(
      expect.arrayContaining([
        {
          id: 'a',
          name: 'a',
          declaredTypes: [],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'b',
          name: 'b',
          declaredTypes: [],
          encounteredTypes: [],
          status: StepResultStatus.DISABLED,
        },
        {
          id: 'c',
          name: 'c',
          declaredTypes: [],
          encounteredTypes: [],
          dependsOn: ['a'],
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'd',
          name: 'd',
          declaredTypes: [],
          encounteredTypes: [],
          dependsOn: ['b', 'c', 'e'],
          status: StepResultStatus.DISABLED,
        },
        {
          id: 'e',
          name: 'e',
          declaredTypes: [],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
      ]),
    );

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyE).toHaveBeenCalledTimes(1);

    expect(spyB).toHaveBeenCalledTimes(0);
    expect(spyD).toHaveBeenCalledTimes(0);

    expect(spyA).toHaveBeenCalledBefore(spyC);
    expect(spyC).toHaveBeenCalledBefore(spyD);
    expect(spyE).toHaveBeenCalledBefore(spyD);
  });
});
