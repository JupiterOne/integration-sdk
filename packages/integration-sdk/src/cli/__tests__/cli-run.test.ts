import { Polly } from '@pollyjs/core';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';
import jwt from 'jsonwebtoken';

import { createCli } from '../index';
import { loadProjectStructure } from '../../__tests__/loadProjectStructure';

import {
  generateSynchronizationJob,
  setupSynchronizerApi,
} from './util/synchronization';

import { SynchronizationJobStatus } from '../../framework/synchronization';
import { StepResultStatus } from '../../framework';

import * as log from '../../log';

jest.mock('../../log');

Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

let polly: Polly;

beforeEach(() => {
  process.env.JUPITERONE_API_KEY = jwt.sign({ account: 'mochi' }, 'test');

  polly = new Polly('run-cli', {
    adapters: ['node-http'],
    persister: 'fs',
    logging: false,
    matchRequestsBy: {
      headers: false,
    },
  });

  loadProjectStructure('typeScriptIntegrationProject');

  jest.spyOn(process, 'exit').mockImplementation((code: number | undefined) => {
    throw new Error(`Process exited with code ${code}`);
  });
});

afterEach(async () => {
  delete process.env.JUPITERONE_API_KEY;
  delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
  await polly.disconnect();
});

test('enables graph object schema validation', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({ polly, job, baseUrl: 'https://api.us.jupiterone.io' });

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
  ]);

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeDefined();
});

test('executes integration and performs upload', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({ polly, job, baseUrl: 'https://api.us.jupiterone.io' });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
  ]);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);

  expect(log.displayExecutionResults).toHaveBeenCalledWith({
    integrationStepResults: [
      {
        id: 'fetch-accounts',
        name: 'Fetch Accounts',
        declaredTypes: ['my_account'],
        encounteredTypes: ['my_account'],
        status: StepResultStatus.SUCCESS,
      },
      {
        id: 'fetch-users',
        name: 'Fetch Users',
        declaredTypes: ['my_user', 'my_account_has_user'],
        encounteredTypes: ['my_user', 'my_account_has_user'],
        status: StepResultStatus.SUCCESS,
      },
    ],
    metadata: {
      partialDatasets: {
        types: [],
      },
    },
  });

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
  expect(log.displaySynchronizationResults).toHaveBeenCalledWith({
    ...job,
    status: SynchronizationJobStatus.FINALIZE_PENDING,
    // These are the expected number of entities and relationships
    // collected when executing the
    // 'typeScriptIntegrationProject' fixture
    numEntitiesUploaded: 2,
    numRelationshipsUploaded: 1,
  });
});
