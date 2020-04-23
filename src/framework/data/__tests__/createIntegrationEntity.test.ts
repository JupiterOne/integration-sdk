import {
  createIntegrationEntity,
  IntegrationEntityData,
} from '../createIntegrationEntity';

const networkSourceData = {
  id: 'natural-identifier',
  environment: 'production',
  CIDR: '255.255.255.0',
  name: 'My Network',
  notInDataModel: 'Not In Data Model',
};

const networkResourceEntity = {
  _key: 'natural-identifier',
  _class: ['Network'],
  _type: 'azure_vpc',
  _rawData: [{ name: 'default', rawData: networkSourceData }],
  id: 'natural-identifier',
  name: 'My Network',
  displayName: 'My Network',
  environment: 'production',
  CIDR: '255.255.255.0',
  public: false,
  internal: true,
};

const networkAssigns = {
  _class: 'Network',
  _type: 'azure_vpc',
  public: false,
  internal: true,
};

const entityData: IntegrationEntityData = {
  assign: networkAssigns,
  source: networkSourceData,
};

describe('createIntegrationEntity', () => {
  test('combines source with assignments', () => {
    const entity = createIntegrationEntity({
      entityData,
    });
    expect(entity).toEqual(networkResourceEntity);
  });

  test('should assign active boolean if source has Active status', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          status: 'Active',
        },
      },
    });
    expect(entity).toHaveProperty('active', true);
  });

  test('should assign createdOn timestamp from creationDate', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          creationDate: new Date('2020-01-01'),
        },
      },
    });
    expect(entity).toHaveProperty(
      'createdOn',
      new Date('2020-01-01').getTime(),
    );
  });

  test('ignore source properties that are not in the data model', () => {
    const entity = createIntegrationEntity({
      entityData,
    });
    expect('notWhitelisted' in entity).toBe(false);
  });

  test('handles empty tags in source data', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [],
        },
      },
    });
    expect(entity.tags).toBeUndefined();
  });

  test('assign array of tags in source data', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'a', Value: 'b' }],
        },
      },
    });
    expect(entity).toMatchObject({ 'tag.a': 'b' });
  });

  test('assign tags to common properties', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'classification', Value: 'critical' }],
        },
      },
    });
    expect(entity).toMatchObject({
      classification: 'critical',
      'tag.classification': 'critical',
    });
  });

  test('assign tags to specified properties', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'a', Value: 'b' }],
        },
        tagProperties: ['a'],
      },
    });
    expect(entity).toMatchObject({ a: 'b', 'tag.a': 'b' });
  });

  test('does not assign displayName without name, tag.name', () => {
    expect(() => {
      createIntegrationEntity({
        entityData: {
          assign: networkAssigns,
          source: { ...networkSourceData, name: undefined },
        },
      });
    }).toThrowError(/name/);
  });

  test('assigns displayName from name when not set by tag.name', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: networkSourceData,
      },
    });
    expect(entity).toMatchObject({ displayName: 'My Network' });
  });

  test('assigns displayName from tag.name', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'name', Value: 'Name from tag.name' }],
        },
      },
    });
    expect(entity).toMatchObject({ displayName: 'Name from tag.name' });
  });

  test('assigns displayName from assigns over name, tag.name', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: { ...networkAssigns, displayName: 'Literal assignment' },
        source: {
          ...networkSourceData,
          tags: [{ Key: 'name', Value: 'Name from tag.name' }],
        },
      },
    });
    expect(entity).toMatchObject({ displayName: 'Literal assignment' });
  });

  test('assigns additional rawData', () => {
    const rawData = { name: 'additional', rawData: 'anything' };
    const entity = createIntegrationEntity({
      entityData: {
        assign: { ...networkAssigns, _rawData: [rawData] },
        source: networkSourceData,
      },
    });
    expect(entity._rawData).toEqual([
      { name: 'default', rawData: entityData.source },
      rawData,
    ]);
  });

  test('assigning default rawData is an error', () => {
    const rawData = { name: 'default', rawData: 'anything' };
    expect(() =>
      createIntegrationEntity({
        entityData: {
          assign: { ...networkAssigns, _rawData: [rawData] },
          source: networkSourceData,
        },
      }),
    ).toThrowError(/duplicate/i);
  });

  test('assigning duplicate rawData is an error', () => {
    const rawData = [
      { name: 'another', rawData: 'anything' },
      { name: 'another', rawData: 'another' },
    ];
    expect(() =>
      createIntegrationEntity({
        entityData: {
          assign: { ...networkAssigns, _rawData: rawData },
          source: networkSourceData,
        },
      }),
    ).toThrowError(/duplicate/i);
  });

  test('empty source is no rawData', () => {
    expect(
      createIntegrationEntity({
        entityData: {
          assign: {
            _class: 'Account',
            _type: 'account-type',
            _key: 'required-when-source-cannot-be-used',
            name: 'Name is required when not provided by source',
          },
          source: {},
        },
      })._rawData,
    ).toEqual([]);
  });
});
