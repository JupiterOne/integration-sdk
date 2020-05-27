import { loadConfigFromEnvironmentVariables } from './config';
import { IntegrationInstance, IntegrationInvocationConfig } from './types';

export const LOCAL_INTEGRATION_INSTANCE: IntegrationInstance = {
  id: 'local-integration-instance',
  accountId: 'Your account',
  name: 'Local Integration',
  integrationDefinitionId: 'local-integration-definition',
  description: 'A generated integration instance for local execution',
  config: {},
} as const;

export function createIntegrationInstanceForLocalExecution(
  config: IntegrationInvocationConfig,
): IntegrationInstance {
  const accountId =
    process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID ||
    LOCAL_INTEGRATION_INSTANCE.accountId;

  return {
    ...LOCAL_INTEGRATION_INSTANCE,
    config: config.instanceConfigFields
      ? loadConfigFromEnvironmentVariables(config.instanceConfigFields)
      : {},
    accountId,
  };
}
