import {
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInstanceConfigField,
  IntegrationInstanceConfigFieldMap,
  IntegrationStepExecutionContext,
} from '../framework';
import { loadInstanceConfigFields } from '../framework/config';
import { loadConfigFromEnvironmentVariables } from '../framework/execution/config';
import { LOCAL_INTEGRATION_INSTANCE } from '../framework/execution/instance';
import {
  createMockJobState,
  CreateMockJobStateOptions,
  MockJobState,
} from './jobState';
import { createMockIntegrationLogger } from './logger';

interface CreateMockExecutionContextOptions<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> {
  instanceConfig?: TConfig;
}

export function createMockExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>({
  instanceConfig,
}: CreateMockExecutionContextOptions<
  TConfig
> = {}): IntegrationExecutionContext<TConfig> {
  const logger = createMockIntegrationLogger();
  const accountId =
    process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID ||
    LOCAL_INTEGRATION_INSTANCE.accountId;

  // copy local instance properties so that tests cannot
  // mutate the original object and cause unpredicable behavior
  const instance = {
    ...LOCAL_INTEGRATION_INSTANCE,
    accountId,
  } as IntegrationInstance<TConfig>;

  if (instanceConfig) {
    instance.config = instanceConfig;
  } else {
    const configFields = loadInstanceConfigFields();
    if (configFields) {
      try {
        instance.config = loadConfigFromEnvironmentVariables(configFields);
      } catch (err) {
        // failed to load configuration, not end of the world
        // because this is only used in testing
        //
        // For convenience, we will generate a config for the developer
        //
        // this would generally only happen when a developer does not
        // have an .env file configured or when an integration's test suite
        // runs in CI
        instance.config = generateInstanceConfig<TConfig>(configFields);
      }
    }
  }

  return {
    logger,
    instance,
  };
}

type CreateMockStepExecutionContextOptions = CreateMockExecutionContextOptions<
  IntegrationInstanceConfig
> &
  CreateMockJobStateOptions;

interface MockIntegrationStepExecutionContext
  extends IntegrationStepExecutionContext {
  jobState: MockJobState;
}

export function createMockStepExecutionContext(
  options: CreateMockStepExecutionContextOptions = {},
): MockIntegrationStepExecutionContext {
  return {
    ...createMockExecutionContext(options),
    jobState: createMockJobState(options),
  };
}

function generateInstanceConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>(configFields: IntegrationInstanceConfigFieldMap): TConfig {
  return Object.entries(configFields).reduce(
    (acc: IntegrationInstance['config'], [field, config]) => {
      acc[field] = getInstanceConfigValueFromType(config);
      return acc;
    },
    {},
  ) as TConfig;
}

function getInstanceConfigValueFromType(
  config: IntegrationInstanceConfigField,
) {
  switch (config.type) {
    case 'boolean':
      return true;
    case 'string':
    default:
      return 'STRING_VALUE';
  }
}
