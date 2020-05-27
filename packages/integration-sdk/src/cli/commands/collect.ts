import { createCommand } from 'commander';

import * as log from '../../log';

import { buildStepDependencyGraph } from '../../framework/execution/dependencyGraph';
import {
  executeIntegrationLocally,
  StepStartStates,
  InvocationConfig,
  ExecutionContext,
  StepExecutionContext,
} from '../../framework';
import { loadConfig } from '../../framework/config';

// coercion function to collect multiple values for a flag
const collecter = (value: string, arr: string[]) => {
  arr.push(...value.split(','));
  return arr;
};

export interface CollectOptions {
  step?: string[];
}

export function prepareLocalStepCollection<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
>(
  config: InvocationConfig<TExecutionContext, TStepExecutionContext>,
  { step = [] }: CollectOptions = {},
) {
  const allStepIds = config.integrationSteps.map((step) => step.id);

  const stepsToRun: string[] = step.filter(
    (step: string | undefined | null) => step !== undefined && step !== null,
  );

  // build out the dependecy graph so we can
  // enable the dependencies of the steps
  // we want to run.
  const depGraph = buildStepDependencyGraph(config.integrationSteps);
  const dependentSteps: string[] = [];
  for (const step of stepsToRun) {
    const dependencies = depGraph.dependenciesOf(step);
    dependentSteps.push(...dependencies);
  }

  stepsToRun.push(...dependentSteps);
  const originalGetStepStartStates = config.getStepStartStates;

  config.getStepStartStates = stepsToRun.length
    ? (ctx) => {
        const originalEnabledRecord = originalGetStepStartStates?.(ctx) ?? {};
        const enabledRecord: StepStartStates = {};
        for (const stepId of allStepIds) {
          const originalValue = originalEnabledRecord[stepId] ?? {};
          if (stepsToRun.includes(stepId)) {
            enabledRecord[stepId] = {
              ...originalValue,
              disabled: false,
            };
          } else {
            enabledRecord[stepId] = {
              ...originalValue,
              disabled: true,
            };
          }
        }
        return enabledRecord;
      }
    : originalGetStepStartStates;

  return config;
}

export function collect() {
  return createCommand('collect')
    .description(
      'Executes the integration and stores the collected data to disk',
    )
    .option(
      '-s, --step <steps>',
      'step(s) to run, comma separated if multiple',
      collecter,
      [],
    )
    .action(async (options) => {
      const config = await loadConfig();
      prepareLocalStepCollection(config, options);
      log.info('\nConfiguration loaded! Running integration...\n');
      const results = await executeIntegrationLocally(config);
      log.displayExecutionResults(results);
    });
}
