import { createCommand } from 'commander';

import * as log from '../../log';
import {
  getApiKeyFromEnvironment,
  getApiBaseUrl,
  createApiClientWithApiKey,
} from '../../framework/api';
import { loadConfig } from '../../framework/config';
import { createIntegrationLogger } from '../../framework/execution/logger';
import {
  initiateSynchronization,
  uploadCollectedData,
  finalizeSynchronization,
} from '../../framework/synchronization';
import { executeIntegrationInstance } from '../../framework/execution';
import { createIntegrationInstanceForLocalExecution } from '../../framework/execution/instance';

export function run() {
  return createCommand('run')
    .description('Performs the collection and synchronization of ')
    .requiredOption(
      '-i, --integrationInstanceId <id>',
      'The id of the integration instance to associate uploaded entities and relationships with.',
    )
    .action(async (options) => {
      log.debug('Loading API Key from JUPITERONE_API_KEY environment variable');
      const apiKey = getApiKeyFromEnvironment();
      const apiBaseUrl = getApiBaseUrl({ dev: !!process.env.JUPITERONE_DEV });
      log.debug(`Configuring client to access "${apiBaseUrl}"`);

      const apiClient = createApiClientWithApiKey({
        apiBaseUrl,
        apiKey,
      });

      const { integrationInstanceId } = options;

      const logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      }).child({ integrationInstanceId });

      const invocationConfig = await loadConfig();

      const synchronizationContext = await initiateSynchronization({
        logger: logger.child({ integrationInstanceId }),
        apiClient,
        integrationInstanceId,
      });

      logger.registerSynchronizationJobContext(synchronizationContext);

      const executionResults = await executeIntegrationInstance(
        logger,
        createIntegrationInstanceForLocalExecution(invocationConfig),
        invocationConfig,
      );

      log.displayExecutionResults(executionResults);

      await uploadCollectedData(synchronizationContext);

      const synchronizationResult = await finalizeSynchronization({
        ...synchronizationContext,
        partialDatasets: executionResults.metadata.partialDatasets,
      });

      log.displaySynchronizationResults(synchronizationResult);
    });
}
