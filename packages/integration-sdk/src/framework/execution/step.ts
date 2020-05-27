import uniq from 'lodash/uniq';

import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from './dependencyGraph';
import {
  ExecutionContext,
  IntegrationStepResult,
  StepResultStatus,
  StepStartStates,
  PartialDatasets,
  Step,
  StepExecutionContext,
} from './types';

export async function executeSteps<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
>(
  context: TExecutionContext,
  steps: Step<TStepExecutionContext>[],
  stepStartStates: StepStartStates,
): Promise<IntegrationStepResult[]> {
  const stepGraph = buildStepDependencyGraph(steps);
  return executeStepDependencyGraph(context, stepGraph, stepStartStates);
}

export function getDefaultStepStartStates<
  TStepExecutionContext extends StepExecutionContext
>(steps: Step<TStepExecutionContext>[]): StepStartStates {
  return steps.reduce(
    (states: StepStartStates, step: Step<TStepExecutionContext>) => {
      states[step.id] = {
        disabled: false,
      };
      return states;
    },
    {},
  );
}

export function determinePartialDatasetsFromStepExecutionResults(
  stepResults: IntegrationStepResult[],
): PartialDatasets {
  return stepResults.reduce(
    (partialDatasets: PartialDatasets, stepResult: IntegrationStepResult) => {
      if (
        stepResult.status === StepResultStatus.FAILURE ||
        stepResult.status ===
          StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE
      ) {
        partialDatasets.types = uniq(
          partialDatasets.types.concat(stepResult.declaredTypes),
        );
      }
      return partialDatasets;
    },
    { types: [] },
  );
}
