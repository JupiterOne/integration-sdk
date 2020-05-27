import path from 'path';
import { createCli } from '../index';
import { loadProjectStructure } from '../../__tests__/loadProjectStructure';
import * as log from '../../log';

import { StepResultStatus } from '../../framework/execution';
import * as nodeFs from 'fs';
const fs = nodeFs.promises;

jest.mock('../../log');

afterEach(() => {
  delete process.env.MY_CONFIG;
});

describe('collect', () => {
  beforeEach(() => {
    loadProjectStructure('instanceWithDependentSteps');
  });

  test('loads the integration, executes it, and logs the result', async () => {
    await createCli().parseAsync(['node', 'j1-integration', 'collect']);

    expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
    expect(log.displayExecutionResults).toHaveBeenCalledWith({
      integrationStepResults: [
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          declaredTypes: ['my_account'],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'fetch-groups',
          dependsOn: ['fetch-accounts'],
          name: 'Fetch Groups',
          declaredTypes: ['my_groups'],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          declaredTypes: ['my_user'],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
        },
      ],
      metadata: {
        partialDatasets: {
          types: [],
        },
      },
    });
  });

  describe('-s or --step option', () => {
    test('will only run the steps provided if the -s / --steps option is passed in', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-users',
      ]);

      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });

    test('will allow filtering to multiple steps if the -s or --steps option has multiple comma separated values', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-users,fetch-accounts',
      ]);

      // fetch-users and fetch-accounts have no dependents and should be the only
      // ones enabled.
      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });

    test('will allow filtering to multiple steps if the -s or --steps option is provided multiple times', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-users',
        '--step',
        'fetch-accounts',
      ]);

      // fetch-users and fetch-accounts have no dependents and should be the only
      // ones enabled.
      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });

    test('will run dependent steps of steps passed in', async () => {
      await createCli().parseAsync([
        'node',
        'j1-integration',
        'collect',
        '--step',
        'fetch-groups',
      ]);
      // fetch-groups depends on fetch-accounts so they should both
      // be enabled.
      expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
      expect(log.displayExecutionResults).toHaveBeenCalledWith({
        integrationStepResults: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            declaredTypes: ['my_account'],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-groups',
            dependsOn: ['fetch-accounts'],
            name: 'Fetch Groups',
            declaredTypes: ['my_groups'],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            declaredTypes: ['my_user'],
            encounteredTypes: [],
            status: StepResultStatus.DISABLED,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      });
    });
  });
});

describe('visualize', () => {
  let htmlFileLocation;
  beforeEach(() => {
    loadProjectStructure('typeScriptVisualizeProject');
    htmlFileLocation = path.resolve(
      process.cwd(),
      'custom-integration',
      'index.html',
    );
  });

  test('writes graph to html file', async () => {
    await createCli().parseAsync([
      'node',
      'j1-integration',
      'visualize',
      '--data-dir',
      'custom-integration',
    ]);

    const content = await fs.readFile(htmlFileLocation, 'utf8');

    const nodesRegex = /var nodes = new vis.DataSet\(\[{.*},{.*}\]\);/g;
    const edgesRegex = /var edges = new vis.DataSet\(\[{.*}\]\);/g;

    expect(log.info).toHaveBeenCalledWith(
      `Visualize graph here: ${htmlFileLocation}`,
    );
    expect(content).toEqual(expect.stringMatching(nodesRegex));
    expect(content).toEqual(expect.stringMatching(edgesRegex));
  });
});

describe('collect/visualize integration', () => {
  let htmlFileLocation;
  beforeEach(() => {
    loadProjectStructure('typeScriptIntegrationProject');

    htmlFileLocation = path.resolve(
      process.cwd(),
      '.j1-integration/graph',
      'index.html',
    );
  });

  test('creates graph based on integration data', async () => {
    await createCli().parseAsync(['node', 'j1-integration', 'collect']);
    await createCli().parseAsync(['node', 'j1-integration', 'visualize']);

    const content = await fs.readFile(htmlFileLocation, 'utf8');

    const nodesRegex = /var nodes = new vis.DataSet\(\[{.*},{.*}\]\);/g;
    const edgesRegex = /var edges = new vis.DataSet\(\[{.*}\]\);/g;

    expect(log.info).toHaveBeenCalledWith(
      `Visualize graph here: ${htmlFileLocation}`,
    );
    expect(content).toEqual(expect.stringMatching(nodesRegex));
    expect(content).toEqual(expect.stringMatching(edgesRegex));
  });
});
