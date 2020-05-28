import path from 'path';

import { mocked } from 'ts-jest/utils';
import globby from 'globby';

import {
  readJsonFromPath,
  getRootStorageDirectory,
  writeFileToPath,
} from '@jupiterone/integration-sdk-runtime';

import { IntegrationData } from '../types/IntegrationData';
import * as log from '../../log';

import { nothingToDisplayMessage } from '../generateVisHTML';
import { generateVisualization } from '../generateVisualization';

jest.mock('fs');
jest.mock('globby');
jest.mock('@jupiterone/integration-sdk-runtime');
jest.mock('../../log');

const mockedGlobby = mocked(globby);
const mockedReadJson = mocked(readJsonFromPath);
const mockedGetRootStorageDirectory = mocked(getRootStorageDirectory);

const integrationPath = '.j1-integration/graph';
const indexHtmlPath = path.resolve(
  process.cwd(),
  integrationPath,
  'index.html',
);
const integrationData: IntegrationData = {
  entities: [
    {
      id: '1',
      _class: 'entity',
      _key: 'entity:1',
      _type: 'entity',
      displayName: 'Entity Name',
    },
  ],
  relationships: [],
};

beforeEach(() => {
  mockedGetRootStorageDirectory.mockReturnValue(integrationPath);
});

test('returns html path when writing the file is successful', async () => {
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({ relationships: integrationData.relationships });
  mockedGlobby.mockResolvedValueOnce([
    `${integrationPath}/index/entities/123.json`,
    `${integrationPath}/index/relationships/abc.json`,
  ]);

  const htmlPath = await generateVisualization(integrationPath);

  expect(htmlPath).toBe(indexHtmlPath);
  expect(writeFileToPath).toBeCalledWith({
    path: indexHtmlPath,
    content: expect.any(String),
  });
});

test('returns empty html when there are no json files', async () => {
  mockedGlobby.mockResolvedValueOnce([]);

  const htmlPath = await generateVisualization(integrationPath);

  expect(htmlPath).toBe(indexHtmlPath);
  expect(log.warn).toHaveBeenCalledWith(
    `Unable to find any files under path: ${path.resolve(
      process.cwd(),
      integrationPath,
    )}`,
  );
  expect(writeFileToPath).toBeCalledWith({
    path: indexHtmlPath,
    content: expect.stringContaining(nothingToDisplayMessage),
  });
});
