import times from 'lodash/times';
import noop from 'lodash/noop';

import { Entity, Relationship } from '../../types';
import { getApiBaseUrl, createApiClient } from '../../api';
import { createIntegrationLogger } from '../../execution';
import { generateSynchronizationJob } from '../../../__tests__/generateSynchronizationJob';

import { uploadData } from '../index';

test('uploads entity data in batches of 250', async () => {
  const { job, logger, apiClient } = createTestContext();

  const data = times(
    510,
    (i): Entity => ({
      _key: `entity:${i}`,
      _type: 'resource',
      _class: 'Resource',
    }),
  );

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await uploadData(
    {
      job,
      logger,
      apiClient,
    },
    'entities',
    data,
  );

  expect(postSpy).toHaveBeenCalledTimes(3);

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(0, 250),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(250, 500),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(500, 510),
    },
  );
});

test('uploads relationship data in batches of 250', async () => {
  const { job, logger, apiClient } = createTestContext();

  const data = times(
    510,
    (i): Relationship => ({
      _key: `relationship:${i}`,
      _type: 'resource',
      _class: 'Resource',
      _fromEntityKey: `entity:${i}`,
      _toEntityKey: `entity:${i + 1}`,
    }),
  );

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await uploadData(
    {
      job,
      logger,
      apiClient,
    },
    'relationships',
    data,
  );

  expect(postSpy).toHaveBeenCalledTimes(3);

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/relationships`,
    {
      relationships: data.slice(0, 250),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/relationships`,
    {
      relationships: data.slice(250, 500),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/relationships`,
    {
      relationships: data.slice(500, 510),
    },
  );
});

function createTestContext() {
  const job = generateSynchronizationJob();

  const logger = createIntegrationLogger({
    name: 'test',
  });

  const apiClient = createApiClient({
    apiBaseUrl: getApiBaseUrl(),
    account: 'test-account',
  });

  return { job, logger, apiClient };
}
