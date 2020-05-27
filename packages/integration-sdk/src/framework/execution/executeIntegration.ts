import { removeStorageDirectory, writeJsonToPath } from '../../fileSystem';
import { createIntegrationInstanceForLocalExecution } from './instance';
import { createIntegrationLogger } from './logger';
import {
  determinePartialDatasetsFromStepExecutionResults,
  executeSteps,
  getDefaultStepStartStates,
} from './step';
import {
  IntegrationInstance,
  IntegrationInvocationConfig,
  IntegrationLogger,
  IntegrationStepResult,
  PartialDatasets,
  InvocationConfig,
  StepExecutionContext,
  ExecutionContext,
} from './types';

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
export function executeIntegrationLocally(config: IntegrationInvocationConfig) {
  return executeIntegrationInstance(
    createIntegrationLogger({
      name: 'Local',
      invocationConfig: config,
      pretty: true,
    }),
    createIntegrationInstanceForLocalExecution(config),
    config,
    { enableSchemaValidation: true },
  );
}

/**
 * Starts execution of an integration instance.
 */
export async function executeIntegrationInstance(
  logger: IntegrationLogger,
  instance: IntegrationInstance,
  config: IntegrationInvocationConfig,
  options: ExecuteIntegrationOptions = {},
): Promise<ExecuteIntegrationResult> {
  if (options.enableSchemaValidation) {
    process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION = 'true';
  }

  const result = await executeWithContext(
    {
      instance,
      logger,
    },
    config,
  );

  return result;
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

  try {
    await config.validateInvocation?.(context);
  } catch (err) {
    context.logger.validationFailure(err);
    throw err;
  }

  const stepStartStates =
    config.getStepStartStates?.(context) ??
    getDefaultStepStartStates(config.integrationSteps);

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

  await context.logger.flush();

  return summary;
}
