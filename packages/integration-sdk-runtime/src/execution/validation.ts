import {
  Step,
  StepExecutionContext,
  StepStartStates,
  StepStartStateUnknownStepIdsError,
  UnaccountedStepStartStatesError,
} from '@jupiterone/integration-sdk-core';

export function validateStepStartStates<
  TStepExecutionContext extends StepExecutionContext
>(steps: Step<TStepExecutionContext>[], stepStartStates: StepStartStates) {
  const stepSet = new Set<string>(steps.map((step) => step.id));

  const unknownStepIds: string[] = [];

  Object.keys(stepStartStates).forEach((stepId) => {
    if (!stepSet.has(stepId)) {
      unknownStepIds.push(stepId);
    }

    stepSet.delete(stepId);
  });

  if (unknownStepIds.length) {
    const unknownStepIdsString = unknownStepIds
      .map((stepId) => `"${stepId}"`)
      .join(', ');

    throw new StepStartStateUnknownStepIdsError(
      `Unknown steps found in start states: ${unknownStepIdsString}`,
    );
  }

  if (stepSet.size > 0) {
    const unaccountedStepIdsString = [...stepSet]
      .map((stepId) => `"${stepId}"`)
      .join(', ');

    throw new UnaccountedStepStartStatesError(
      `Start states not found for: ${unaccountedStepIdsString}`,
    );
  }
}
