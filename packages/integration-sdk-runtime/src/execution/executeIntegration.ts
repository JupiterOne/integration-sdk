import {
  IntegrationInstance,
  IntegrationInvocationConfig,
  IntegrationStepResult,
  PartialDatasets,
  InvocationConfig,
  IntegrationLogger,
  ExecutionContext,
  StepExecutionContext,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import {
  removeStorageDirectory,
  writeJsonToPath,
  getRootStorageDirectorySize,
} from '../fileSystem';
import { createIntegrationInstanceForLocalExecution } from './instance';
import { createIntegrationLogger } from '../logger';
import {
  determinePartialDatasetsFromStepExecutionResults,
  executeSteps,
  getDefaultStepStartStates,
} from './step';
import { validateStepStartStates } from './validation';
import { timeOperation } from '../metrics';

export interface ExecuteIntegrationResult {
  integrationStepResults: IntegrationStepResult[];
  metadata: {
    partialDatasets: PartialDatasets;
  };
}

interface ExecuteIntegrationOptions {
  enableSchemaValidation?: boolean;
}

/**
 * Starts execution of an integration instance generated from local environment
 * variables.
 */
export function executeIntegrationLocally(
  config: IntegrationInvocationConfig,
  options?: { enableSchemaValidation?: boolean },
) {
  return executeIntegrationInstance(
    createIntegrationLogger({
      name: 'Local',
      invocationConfig: config,
      pretty: true,
    }),
    createIntegrationInstanceForLocalExecution(config),
    config,
    {
      enableSchemaValidation:
        options?.enableSchemaValidation !== undefined
          ? options.enableSchemaValidation
          : true,
    },
  );
}

/**
 * Starts execution of an integration instance.
 */
export async function executeIntegrationInstance(
  logger: IntegrationLogger | IntegrationLogger,
  instance: IntegrationInstance,
  config: IntegrationInvocationConfig,
  options: ExecuteIntegrationOptions = {},
): Promise<ExecuteIntegrationResult> {
  if (options.enableSchemaValidation) {
    process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION = 'true';
  }

  return timeOperation({
    logger,
    metricName: 'duration-collect',
    operation: () =>
      executeWithContext(
        {
          instance,
          logger,
        },
        config,
      ),
  });
}

/**
 * Executes an integration and performs actions defined by the config
 * using context that was provided.
 */
export async function executeWithContext<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
>(
  context: TExecutionContext,
  config: InvocationConfig<TExecutionContext, TStepExecutionContext>,
): Promise<ExecuteIntegrationResult> {
  await removeStorageDirectory();

  const { logger } = context;

  try {
    await config.validateInvocation?.(context);
  } catch (err) {
    logger.validationFailure(err);
    throw err;
  }

  const stepStartStates: StepStartStates =
    (await config.getStepStartStates?.(context)) ??
    getDefaultStepStartStates(config.integrationSteps);

  validateStepStartStates(config.integrationSteps, stepStartStates);

  const integrationStepResults = await executeSteps(
    context,
    config.integrationSteps,
    stepStartStates,
  );

  const partialDatasets = determinePartialDatasetsFromStepExecutionResults(
    integrationStepResults,
  );

  const summary: ExecuteIntegrationResult = {
    integrationStepResults,
    metadata: {
      partialDatasets,
    },
  };

  await writeJsonToPath({
    path: 'summary.json',
    data: summary,
  });

  context.logger.info(
    { collectionResult: summary },
    'Integration data collection has completed.',
  );

  context.logger.publishMetric({
    name: 'disk-usage',
    value: await getRootStorageDirectorySize(),
    unit: 'Bytes',
  });

  return summary;
}
