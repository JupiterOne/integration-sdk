import chalk from 'chalk';

import {
  ExecuteIntegrationResult,
  IntegrationStepResult,
  StepResultStatus,
} from './framework/execution';
import { SynchronizationJob } from './framework/synchronization';

export function debug(msg: string) {
  console.log(`${chalk.gray(msg)}`);
}

export function info(msg: string) {
  console.log(`${chalk.white(msg)}`);
}

export function warn(msg: string) {
  console.log(`${chalk.yellow(msg)}`);
}

export function displaySynchronizationResults(job: SynchronizationJob) {
  info('\nSynchronization results:\n');
  info(`Synchronization job status: ${chalk.cyan(job.status)}`);
  info(`Entities uploaded: ${chalk.cyan(job.numEntitiesUploaded)}`);
  info(`Relationships uploaded: ${chalk.cyan(job.numRelationshipsUploaded)}`);
}

export function displayExecutionResults(results: ExecuteIntegrationResult) {
  info('\nResults:\n');

  let undeclaredTypesDetected: boolean = false;

  results.integrationStepResults.forEach((step) => {
    logStepStatus(step);

    if (step.status === StepResultStatus.SUCCESS) {
      const { declaredTypes, encounteredTypes } = step;

      const declaredTypeSet = new Set(declaredTypes);
      const undeclaredTypes = encounteredTypes.filter(
        (type) => !declaredTypeSet.has(type),
      );

      if (undeclaredTypes.length) {
        undeclaredTypesDetected = true;

        const undeclaredTypesList = undeclaredTypes.map((type) => {
          return `\n  - ${type}`;
        });
        warn(
          `The following types were encountered but are not declared in the step's "types" field:${undeclaredTypesList}`,
        );

        console.log('');
      }
    }
  });

  if (undeclaredTypesDetected) {
    warn(
      `\nUndeclared types were detected!
To ensure that integration failures do not cause accidental data loss,
please ensure that all known entity and relationship types
collected by a step are declared in the step's "types" field.`,
    );
  }

  const { partialDatasets } = results.metadata;

  if (partialDatasets.types.length) {
    warn('\nThe following datasets were marked as partial:');
    info(partialDatasets.types.map((type) => `  - ${type}`).join('\n'));
  }
}

function logStepStatus(stepResult: IntegrationStepResult) {
  const stepPrefix = chalk.white(
    `Step "${chalk.cyan(stepResult.id)}" completed with status:`,
  );
  const statusText = getStepStatusText(stepResult.status);
  console.log(`${stepPrefix} ${statusText}`);
}

function getStepStatusText(status: StepResultStatus) {
  switch (status) {
    case StepResultStatus.SUCCESS:
      return chalk.green(status);
    case StepResultStatus.FAILURE:
      return chalk.red(status);
    case StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE:
      return chalk.yellow(status);
    case StepResultStatus.DISABLED:
      return chalk.gray(status);
  }
}
