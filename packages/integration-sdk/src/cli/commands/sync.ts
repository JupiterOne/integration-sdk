import { createCommand } from 'commander';

import * as log from '../../log';
import {
  getApiKeyFromEnvironment,
  getApiBaseUrl,
  createApiClientWithApiKey,
} from '../../framework/api';
import { createIntegrationLogger } from '../../framework/execution/logger';
import { synchronizeCollectedData } from '../../framework/synchronization';

export function sync() {
  return createCommand('sync')
    .description('Synchronizes collected data with the JupiterOne graph.')
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
      });

      const job = await synchronizeCollectedData({
        logger: logger.child({ integrationInstanceId }),
        apiClient,
        integrationInstanceId,
      });

      log.displaySynchronizationResults(job);
    });
}
