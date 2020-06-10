import { SynchronizationJob } from '@jupiterone/integration-sdk-core';
import { createIntegrationLogger } from '../../logger';
import { createApiClient } from '../../api';

import { createEventPublishingQueue } from '../index';
import noop from 'lodash/noop';

test('publishes events added to the queue in the order they were enqueued', async () => {
  const eventA = {
    name: 'a',
    description: 'Event A',
  };

  const eventB = {
    name: 'b',
    description: 'Event B',
  };

  const { apiClient, job, queue } = createContext();

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  queue.enqueue(eventA);
  queue.enqueue(eventB);

  await queue.onIdle();

  expect(postSpy).toHaveBeenCalledTimes(2);
  expect(postSpy).toHaveBeenNthCalledWith(
    1,
    `/persister/synchronization/jobs/${job.id}/events`,
    { events: [eventA] },
  );

  expect(postSpy).toHaveBeenNthCalledWith(
    2,
    `/persister/synchronization/jobs/${job.id}/events`,
    { events: [eventB] },
  );
});

test('logs an error if publish fails', async () => {
  const event = {
    name: 'a',
    description: 'Event A',
  };

  const { apiClient, logger, queue } = createContext();

  const error = new Error('Failed to post event');
  jest.spyOn(apiClient, 'post').mockRejectedValue(error);

  const logErrorSpy = jest.spyOn(logger, 'error');

  queue.enqueue(event);

  await queue.onIdle();

  expect(logErrorSpy).toHaveBeenCalledTimes(1);
  expect(logErrorSpy).toHaveBeenCalledWith(
    {
      err: error,
    },
    'Failed to publish integration event',
  );
});

function createContext() {
  const apiClient = createApiClient({
    apiBaseUrl: 'https://mochi:8080',
    account: 'mochi',
  });

  const logger = createIntegrationLogger({
    name: 'test',
  });

  const job = { id: 'test' } as SynchronizationJob;

  return {
    apiClient,
    logger,
    job,
    queue: createEventPublishingQueue({ apiClient, logger, job }),
  };
}
