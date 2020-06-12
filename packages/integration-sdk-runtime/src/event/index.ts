import { IntegrationEvent } from '@jupiterone/integration-sdk-core';
import PromiseQueue from 'p-queue';

import { SynchronizationJobContext } from '../synchronization';

export const createEventPublishingQueue = ({
  apiClient,
  logger,
  job,
}: SynchronizationJobContext) => {
  const queue = new PromiseQueue({ concurrency: 1 });

  return {
    enqueue(event: IntegrationEvent) {
      return queue.add(async () => {
        try {
          await apiClient.post(
            `/persister/synchronization/jobs/${job.id}/events`,
            {
              events: [event],
            },
          );
        } catch (err) {
          logger.error({ err }, 'Failed to publish integration event');
        }
      });
    },
    onIdle: () => queue.onIdle(),
  };
};
