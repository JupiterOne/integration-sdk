import { mocked } from 'ts-jest/utils';

import { retrieveIntegrationData } from '../retrieveIntegrationData';
import { readJsonFromPath } from '../../../fileSystem';
import { IntegrationData } from '../types';
import { createIntegrationRelationship } from '../../data';
import { ExplicitRelationship } from '../../types';

jest.mock('../../../fileSystem');

const mockedReadJson = mocked(readJsonFromPath);

const integrationPath = '/j1-integration';
const integrationData: IntegrationData = {
  entities: [
    { id: '1', _class: 'entity', _key: 'entity:1', _type: 'entity' },
    { id: '2', _class: 'entity', _key: 'entity:2', _type: 'entity' },
  ],
  relationships: [
    createIntegrationRelationship({
      _class: 'HAS',
      fromKey: 'entity:1',
      fromType: 'entity',
      toKey: 'entity:2',
      toType: 'entity',
    }) as ExplicitRelationship,
  ],
};

afterEach(() => {
  jest.resetAllMocks();
});

test('no files found returns empty result set', async () => {
  const result = await retrieveIntegrationData([]);
  expect(result.entities).toEqual([]);
  expect(result.relationships).toEqual([]);
});

test('returns the json objects read from the files', async () => {
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({ relationships: integrationData.relationships });

  const result = await retrieveIntegrationData([
    `${integrationPath}/graph/entity/entities/123.json`,
    `${integrationPath}/graph/entity/relationships/abc.json`,
  ]);

  expect(result).toEqual(integrationData);
});

test('excludes mapped relationships', async () => {
  const mappedRelationship = {
    _mapping: 'user_is_user',
    id: '123456',
  };
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({
      relationships: [...integrationData.relationships, mappedRelationship],
    });

  const result = await retrieveIntegrationData([
    `${integrationPath}/graph/entity/entities/123.json`,
    `${integrationPath}/graph/entity/relationships/abc.json`,
  ]);

  expect(result).toEqual(integrationData);
});
