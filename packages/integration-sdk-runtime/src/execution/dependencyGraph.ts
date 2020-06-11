import { DepGraph } from 'dependency-graph';
import PromiseQueue from 'p-queue';

import { FileSystemGraphObjectStore } from '../storage';
import {
  createStepJobState,
  DuplicateKeyTracker,
  MemoryDataStore,
  TypeTracker,
} from './jobState';
import {
  Step,
  IntegrationStepResult,
  StepResultStatus,
  StepStartStates,
  ExecutionContext,
  StepExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { timeOperation } from '../metrics';

/**
 * This function accepts a list of steps and constructs a dependency graph
 * using the `dependsOn` field from each step.
 */
export function buildStepDependencyGraph<
  TStepExecutionContext extends StepExecutionContext
>(steps: Step<TStepExecutionContext>[]): DepGraph<Step<TStepExecutionContext>> {
  const dependencyGraph = new DepGraph<Step<TStepExecutionContext>>();

  // add all nodes first
  steps.forEach((step) => {
    dependencyGraph.addNode(step.id, step);
  });

  // add dependencies
  steps.forEach((step) => {
    step.dependsOn?.forEach((dependency) => {
      dependencyGraph.addDependency(step.id, dependency);
    });
  });

  // executing overallOrder will throw an error
  // if a circular dependency is found
  dependencyGraph.overallOrder();

  return dependencyGraph;
}

/**
 * This function takes a step dependency graph and executes
 * the steps in order based on the values of their `dependsOn`.
 *
 * How execution works:
 *
 * First, all leaf nodes are executed.
 *
 * After each node's work completes, the node is removed from
 * the dependency graph. After the node is removed,
 * the graph checks to see if the removal of the node has
 * created more leaf nodes and executes them. This continues
 * until there are no more nodes to execute.
 */
export function executeStepDependencyGraph<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
>(
  executionContext: TExecutionContext,
  inputGraph: DepGraph<Step<TStepExecutionContext>>,
  stepStartStates: StepStartStates,
): Promise<IntegrationStepResult[]> {
  // create a clone of the dependencyGraph because mutating
  // the input graph is icky
  //
  // cloned graph is mutated because it is slightly easier to
  // remove nodes from the graph to find new leaf nodes
  // instead of tracking state ourselves
  const workingGraph = inputGraph.clone();

  // create a queue for managing promises to be executed
  const promiseQueue = new PromiseQueue();

  const graphObjectStore = new FileSystemGraphObjectStore();

  const stepResultsMap = buildStepResultsMap(inputGraph, stepStartStates);
  const duplicateKeyTracker = new DuplicateKeyTracker();
  const dataStore = new MemoryDataStore();

  function isStepEnabled(stepId: string) {
    return stepStartStates[stepId].disabled === false;
  }
  StepResultStatus;
  /**
   * Updates the result of a step result with the provided satus
   */
  function updateStepResultStatus(
    stepId: string,
    status: StepResultStatus,
    typeTracker: TypeTracker,
  ) {
    const existingResult = stepResultsMap.get(stepId);
    if (existingResult) {
      stepResultsMap.set(stepId, {
        ...existingResult,
        status,
        encounteredTypes: typeTracker.getEncounteredTypes(),
      });
    }
  }

  /**
   * Finds a result from the dependency graph that contains
   * a status of FAILURE or PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE.
   *
   * NOTE: the untouched input graph is used for determining
   * results since the working graph gets mutated.
   */
  function stepHasDependencyFailure(stepId: string) {
    return inputGraph
      .dependenciesOf(stepId)
      .map((id) => stepResultsMap.get(id))
      .find((result) => {
        const status = result?.status;
        return (
          status === StepResultStatus.FAILURE ||
          status === StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE
        );
      });
  }

  /**
   * Safely removes a step from the workingGraph, ensuring
   * that dependencys are removed.
   *
   * This function helps create new leaf nodes to execute.
   */
  function removeStepFromWorkingGraph(stepId: string) {
    workingGraph.dependantsOf(stepId).forEach((dependent) => {
      workingGraph.removeDependency(dependent, stepId);
    });

    workingGraph.removeNode(stepId);
  }

  /**
   * This function checks if a step's dependencies are complete
   */
  function stepDependenciesAreComplete(stepId: string) {
    const executingDependencies = inputGraph
      .dependenciesOf(stepId)
      .map((id) => stepResultsMap.get(id))
      .filter(
        (stepResult) =>
          stepResult?.status === StepResultStatus.PENDING_EVALUATION,
      );

    return executingDependencies.length === 0;
  }

  /**
   * Logs undeclaredTypes if any are found.
   */
  function maybeLogUndeclaredTypes(
    context: TStepExecutionContext,
    step: Step<TStepExecutionContext>,
    typeTracker: TypeTracker,
  ) {
    const declaredTypes = step.types;
    const encounteredTypes = typeTracker.getEncounteredTypes();

    const declaredTypesSet = new Set(declaredTypes);
    const undeclaredTypes = encounteredTypes.filter(
      (type) => !declaredTypesSet.has(type),
    );

    if (undeclaredTypes.length) {
      context.logger.warn(
        {
          undeclaredTypes,
        },
        'Undeclared types were detected.',
      );
    }
  }

  return new Promise((resolve, reject) => {
    /**
     * If an unexpected error occurs during the execution of a step,
     * this function catch that, pause the queue so that
     * additional work is not executed and reject the promise.
     */
    function handleUnexpectedError(err: Error) {
      promiseQueue.pause();
      reject(err);
    }

    /**
     * This function finds leaf steps that can be executed
     * and adds the step execution to the promise queue.
     *
     * As prior to enqueuing the work, step is removed from the
     * working graph.
     */
    function enqueueLeafSteps() {
      // do not add more work if promise queue has been paused.
      if (promiseQueue.isPaused) {
        return;
      }

      workingGraph.overallOrder(true).forEach((stepId) => {
        const step = workingGraph.getNodeData(stepId);

        /**
         * We only remove the node from the graph and
         * execute the step if it is enabled.
         *
         * This allows for dependencies to remain in the graph
         * and prevents dependent steps from executing.
         */
        if (isStepEnabled(stepId) && stepDependenciesAreComplete(stepId)) {
          removeStepFromWorkingGraph(stepId);
          promiseQueue.add(() =>
            timeOperation({
              logger: executionContext.logger,
              metricName: `${stepId}-duration`,
              operation: () => executeStep(step),
            }).catch(handleUnexpectedError),
          );
        }
      });
    }

    /**
     * This function runs a step's executionHandler.
     *
     * Errors from an execution handler are caught and used to
     * determine a status code for the step's result.
     */
    async function executeStep(step: Step<TStepExecutionContext>) {
      const { id: stepId } = step;
      const typeTracker = new TypeTracker();

      const context = buildStepContext<TStepExecutionContext>({
        context: executionContext,
        duplicateKeyTracker,
        typeTracker,
        graphObjectStore,
        dataStore,
        stepId,
      });

      const { logger } = context;

      logger.stepStart(step);

      let status: StepResultStatus;

      try {
        await step.executionHandler(context);
        context.logger.stepSuccess(step);

        if (stepHasDependencyFailure(stepId)) {
          status = StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE;
        } else {
          status = StepResultStatus.SUCCESS;
          maybeLogUndeclaredTypes(context, step, typeTracker);
        }
      } catch (err) {
        context.logger.stepFailure(step, err);

        if (err.fatal) {
          // rethrow the error to stop dependency graph execution
          throw err;
        }

        status = StepResultStatus.FAILURE;
      }

      await context.jobState.flush();
      updateStepResultStatus(stepId, status, typeTracker);
      enqueueLeafSteps();
    }

    // kick off work for all leaf nodes
    enqueueLeafSteps();

    promiseQueue.onIdle().then(() => resolve([...stepResultsMap.values()]));
  });
}

function buildStepContext<TStepExecutionContext extends StepExecutionContext>({
  stepId,
  context,
  duplicateKeyTracker,
  typeTracker,
  graphObjectStore,
  dataStore,
}: {
  stepId: string;
  context: ExecutionContext;
  duplicateKeyTracker: DuplicateKeyTracker;
  typeTracker: TypeTracker;
  graphObjectStore: FileSystemGraphObjectStore;
  dataStore: MemoryDataStore;
}): TStepExecutionContext {
  const stepExecutionContext: StepExecutionContext = {
    ...context,
    logger: context.logger.child({
      stepId,
    }),
    jobState: createStepJobState({
      stepId,
      duplicateKeyTracker,
      typeTracker,
      graphObjectStore,
      dataStore,
    }),
  };

  return stepExecutionContext as TStepExecutionContext;
}

function buildStepResultsMap<
  TStepExecutionContext extends StepExecutionContext
>(
  dependencyGraph: DepGraph<Step<TStepExecutionContext>>,
  stepStartStates: StepStartStates,
) {
  const stepResultMapEntries = dependencyGraph
    .overallOrder()
    .map(
      (stepId): IntegrationStepResult => {
        const step = dependencyGraph.getNodeData(stepId);

        const hasDisabledDependencies =
          dependencyGraph
            .dependenciesOf(step.id)
            .filter((id) => stepStartStates[id].disabled).length > 0;

        return {
          id: step.id,
          name: step.name,
          dependsOn: step.dependsOn,
          declaredTypes: step.types,
          encounteredTypes: [],
          status:
            stepStartStates[step.id].disabled || hasDisabledDependencies
              ? StepResultStatus.DISABLED
              : StepResultStatus.PENDING_EVALUATION,
        };
      },
    )
    .map((result): [string, IntegrationStepResult] => [result.id, result]);

  return new Map<string, IntegrationStepResult>(stepResultMapEntries);
}
