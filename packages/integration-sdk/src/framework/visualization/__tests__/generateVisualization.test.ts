import { generateVisualization } from '../generateVisualization';
import { mocked } from 'ts-jest/utils';
import globby from 'globby';
import { IntegrationData } from '../types/IntegrationData';
import {
  readJsonFromPath,
  getRootStorageDirectory,
  writeFileToPath,
} from '../../../fileSystem';
import path from 'path';
import { nothingToDisplayMessage } from '../generateVisHTML';
import * as log from '../../../log';

jest.mock('globby');
jest.mock('../../../fileSystem');
jest.mock('../../../log');
jest.mock('fs');

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
