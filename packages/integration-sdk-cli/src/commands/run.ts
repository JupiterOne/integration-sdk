import { createCommand } from 'commander';

import * as log from '../log';
import {
  getApiKeyFromEnvironment,
  getApiBaseUrl,
  createApiClientWithApiKey,
  initiateSynchronization,
  uploadCollectedData,
  finalizeSynchronization,
  abortSynchronization,
  createIntegrationLogger,
  executeIntegrationInstance,
  createIntegrationInstanceForLocalExecution,
  createEventPublishingQueue,
} from '@jupiterone/integration-sdk-runtime';

import { loadConfig } from '../config';

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

      let logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      });

      const synchronizationContext = await initiateSynchronization({
        logger,
        apiClient,
        integrationInstanceId,
      });

      const eventPublishingQueue = createEventPublishingQueue(
        synchronizationContext,
      );
      logger.on('event', (event) => eventPublishingQueue.enqueue(event));

      logger = synchronizationContext.logger;

      const invocationConfig = await loadConfig();

      try {
        const executionResults = await executeIntegrationInstance(
          logger,
          createIntegrationInstanceForLocalExecution(invocationConfig),
          invocationConfig,
          {
            enableSchemaValidation: true,
          },
        );

        await eventPublishingQueue.onIdle();

        log.displayExecutionResults(executionResults);

        await uploadCollectedData(synchronizationContext);

        const synchronizationResult = await finalizeSynchronization({
          ...synchronizationContext,
          partialDatasets: executionResults.metadata.partialDatasets,
        });

        log.displaySynchronizationResults(synchronizationResult);
      } catch (err) {
        await eventPublishingQueue.onIdle();
        if (!logger.isHandledError(err)) {
          logger.error(
            err,
            'Unexpected error occurred during integration run.',
          );
        }

        const abortResult = await abortSynchronization({
          ...synchronizationContext,
          reason: err.message,
        });

        log.displaySynchronizationResults(abortResult);
      }
    });
}
