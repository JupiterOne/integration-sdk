import { v4 as uuid } from 'uuid';
import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

export function generateEntity(overrides?: Partial<Entity>): Entity {
  return {
    _key: uuid(),
    _type: uuid(),
    _class: uuid(),
    ...overrides,
  };
}

export function generateRelationship(
  overrides?: Partial<Relationship>,
): Relationship {
  return {
    _key: uuid(),
    _type: uuid(),
    _class: uuid(),
    _toEntityKey: uuid(),
    _fromEntityKey: uuid(),
    ...overrides,
  };
}
