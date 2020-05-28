import {
  createIntegrationRelationship,
  generateRelationshipType,
} from '../createIntegrationRelationship';

import {
  Entity,
  Relationship,
  RelationshipDirection,
  MappedRelationship,
} from '../../types';

describe('DirectRelationshipOptions', () => {
  const entityA: Entity = {
    _type: 'a_entity',
    _class: 'A',
    _key: 'a',
  };

  const entityB: Entity = {
    _type: 'b_entity',
    _class: 'B',
    _key: 'b',
  };

  const expected: Relationship = {
    _type: 'a_entity_has_b_entity',
    _class: 'HAS',
    _key: 'a|has|b',
    _fromEntityKey: 'a',
    _toEntityKey: 'b',
    displayName: 'HAS',
  };

  test('defaults', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        from: entityA,
        to: entityB,
      }),
    ).toEqual(expected);
  });

  test('_class is upcased', () => {
    expect(
      createIntegrationRelationship({
        _class: 'has',
        from: entityA,
        to: entityB,
      }),
    ).toEqual(expected);
  });

  test('transfers additional properties', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        from: entityA,
        to: entityB,
        properties: {
          region: 'useast',
        },
      }),
    ).toEqual({ ...expected, region: 'useast' });
  });
});

describe('DirectRelationshipLiteralOptions', () => {
  const expected: Relationship = {
    _type: 'a_entity_has_b_entity',
    _class: 'HAS',
    _key: 'a|has|b',
    _fromEntityKey: 'a',
    _toEntityKey: 'b',
    displayName: 'HAS',
  };

  test('defaults', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        fromKey: 'a',
        fromType: 'a_entity',
        toKey: 'b',
        toType: 'b_entity',
      }),
    ).toEqual(expected);
  });

  test('_class is upcased', () => {
    expect(
      createIntegrationRelationship({
        _class: 'has',
        fromKey: 'a',
        fromType: 'a_entity',
        toKey: 'b',
        toType: 'b_entity',
      }),
    ).toEqual(expected);
  });
});

describe('MappedRelationshipOptions', () => {
  const entityA: Entity = {
    _type: 'a_entity',
    _class: 'A',
    _key: 'a',
  };

  const entityB: Entity = {
    _type: 'b_entity',
    _class: 'B',
    _key: 'b',
  };

  const expected: MappedRelationship = {
    _key: 'a|has|b',
    _type: 'mapping_source_has_b_entity',
    _class: 'HAS',
    _mapping: {
      relationshipDirection: RelationshipDirection.FORWARD,
      sourceEntityKey: 'a',
      targetFilterKeys: [['_type', '_key']],
      targetEntity: {
        _key: 'b',
        _class: 'B',
        _type: 'b_entity',
      },
    },
    displayName: 'HAS',
  };

  test('defaults', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        source: entityA,
        target: entityB,
      }),
    ).toEqual(expected);
  });

  test('_class is upcased', () => {
    expect(
      createIntegrationRelationship({
        _class: 'has',
        source: entityA,
        target: entityB,
      }),
    ).toEqual(expected);
  });

  test('additional properties', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        source: entityA,
        target: entityB,
        properties: {
          region: 'useast',
        },
      }),
    ).toEqual({ ...expected, region: 'useast' });
  });

  test('override defaults', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        source: entityA,
        target: entityB,
        properties: {
          _key: 'use-my-key-yo',
          _type: 'a_entity_has_b_entity',
          displayName: 'ISHASING',
        },
      }),
    ).toEqual({
      ...expected,
      _key: 'use-my-key-yo',
      _type: 'a_entity_has_b_entity',
      displayName: 'ISHASING',
    });
  });
});

describe('MappedRelationshipLiteralOptions', () => {
  const expected: MappedRelationship = {
    _key: 'a|has|b',
    _type: 'mapping_source_has_b_entity',
    _class: 'HAS',
    _mapping: {
      relationshipDirection: RelationshipDirection.REVERSE,
      sourceEntityKey: 'a',
      targetFilterKeys: [['something']],
      targetEntity: {
        _key: 'b',
        _type: 'b_entity',
      },
    },
    displayName: 'HAS',
  };

  test('defaults', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.REVERSE,
          targetEntity: {
            _key: 'b',
            _type: 'b_entity',
          },
          targetFilterKeys: [['something']],
          sourceEntityKey: 'a',
        },
      }),
    ).toEqual(expected);
  });

  test('missing _key in targetEntity', () => {
    expect(() => {
      createIntegrationRelationship({
        _class: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.REVERSE,
          targetEntity: {
            something: 'missing',
            _type: 'b_entity',
          },
          targetFilterKeys: [['something']],
          sourceEntityKey: 'a',
        },
      });
    }).toThrowError(/_key/);
  });

  test('missing _type in targetEntity', () => {
    expect(() => {
      createIntegrationRelationship({
        _class: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.REVERSE,
          targetEntity: {
            something: 'missing',
            _key: 'b',
          },
          targetFilterKeys: [['something']],
          sourceEntityKey: 'a',
        },
      });
    }).toThrowError(/_type/);
  });

  test('_key, _type provided explicitly', () => {
    expect(
      createIntegrationRelationship({
        _class: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.REVERSE,
          targetEntity: {
            something: 'missing',
          },
          targetFilterKeys: [['something']],
          sourceEntityKey: 'a',
        },
        properties: {
          _key: 'a-has-b',
          _type: 'a_entity_has_b_entity',
        },
      }),
    ).toEqual({
      ...expected,
      _key: 'a-has-b',
      _type: 'a_entity_has_b_entity',
      _mapping: {
        ...expected._mapping,
        targetEntity: {
          something: 'missing',
        },
      },
    });
  });
});

describe('generateRelationshipType', () => {
  const entityA: Entity = {
    _type: 'a_entity',
    _class: 'A',
    _key: 'a',
  };

  const entityB: Entity = {
    _type: 'b_entity',
    _class: 'B',
    _key: 'b',
  };

  test('entities', () => {
    expect(generateRelationshipType('HAS', entityA, entityB)).toEqual(
      'a_entity_has_b_entity',
    );
  });

  test('strings', () => {
    expect(generateRelationshipType('HAS', 'a_entity', 'b_entity')).toEqual(
      'a_entity_has_b_entity',
    );
  });

  test('from entity to string', () => {
    expect(generateRelationshipType('HAS', entityA, 'b_entity')).toEqual(
      'a_entity_has_b_entity',
    );
  });

  test('from string to entity', () => {
    expect(generateRelationshipType('HAS', 'a_entity', entityB)).toEqual(
      'a_entity_has_b_entity',
    );
  });

  test('from and to entities of the same type', () => {
    expect(
      generateRelationshipType('HAS', 'aws_instance', 'aws_instance'),
    ).toEqual('aws_instance_has_instance');
  });

  test('from and to entities within the same provider but different service scope', () => {
    expect(
      generateRelationshipType('HAS', 'aws_vpc', 'aws_lambda_function'),
    ).toEqual('aws_vpc_has_lambda_function');
  });

  test('from and to entities within the same provider and service scope', () => {
    expect(
      generateRelationshipType('HAS', 'azure_sql_server', 'azure_sql_database'),
    ).toEqual('azure_sql_server_has_database');
  });

  test('entity type has no underscore', () => {
    expect(
      generateRelationshipType('HAS', 'employee', 'user_endpoint'),
    ).toEqual('employee_has_user_endpoint');
  });
});
