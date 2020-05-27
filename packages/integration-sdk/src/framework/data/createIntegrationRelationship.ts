import {
  Entity,
  Relationship,
  ExplicitRelationship,
  RelationshipMapping,
  RelationshipDirection,
  TargetEntityProperties,
  TargetFilterKey,
  MappedRelationship,
} from '../types';
import { IntegrationError } from '../../errors';

type DirectRelationshipOptions = {
  _class: string;
  from: Entity;
  to: Entity;
  properties?: AdditionalRelationshipProperties;
};

type DirectRelationshipLiteralOptions = {
  _class: string;
  fromType: string;
  fromKey: string;
  toType: string;
  toKey: string;
  properties?: AdditionalRelationshipProperties;
};

type MappedRelationshipOptions = {
  _class: string;
  source: Entity;
  target: TargetEntity;
  properties?: AdditionalRelationshipProperties;

  /**
   * Defaults to `RelationshipDirection.FORWARD`, assuming the common case of
   * source -> target.
   */
  relationshipDirection?: RelationshipDirection;

  /**
   * Defaults to `[["_type", "_key"]]`, allowing for the simple case of mapping
   * to a known type and key.
   */
  targetFilterKeys?: TargetFilterKey[];

  /**
   * Defaults to `undefined`, leaving it up to the default established in the
   * mapper.
   */
  skipTargetCreation?: boolean;
};

type MappedRelationshipLiteralOptions = {
  _class: string;
  _key?: string;
  _mapping: RelationshipMapping;
  properties?: AdditionalRelationshipProperties;
};

type TargetEntity = TargetEntityProperties & {
  _type: string;
  _key: string;
};

/**
 * Allows assignment of any additional properties without being forced to use
 * specific types where that isn't helpful.
 */
type AdditionalRelationshipProperties = { [key: string]: any };

/**
 * Create an `IntegrationRelationship`.
 *
 * `DirectRelationshipOptions` and `MappedRelationshipOptions` are recommended
 * over literal forms. Older integrations may need to use the literal forms to
 * control values for some reason or other.
 */
export function createIntegrationRelationship(
  options:
    | DirectRelationshipOptions
    | DirectRelationshipLiteralOptions
    | MappedRelationshipOptions
    | MappedRelationshipLiteralOptions,
): Relationship {
  if ('_mapping' in options) {
    return createMappedRelationship(options);
  } else if ('target' in options) {
    return createMappedRelationship({
      _class: options._class,
      _mapping: {
        relationshipDirection:
          options.relationshipDirection || RelationshipDirection.FORWARD,
        sourceEntityKey: options.source._key,
        targetEntity: options.target,
        targetFilterKeys: options.targetFilterKeys || [['_type', '_key']],
        skipTargetCreation: options.skipTargetCreation,
      },
      properties: options.properties,
    });
  } else if ('fromType' in options) {
    return createRelationship(options);
  } else {
    return createRelationship({
      _class: options._class,
      fromType: options.from._type,
      fromKey: options.from._key,
      toType: options.to._type,
      toKey: options.to._key,
      properties: options.properties,
    });
  }
}

function createMappedRelationship(
  options: MappedRelationshipLiteralOptions,
): MappedRelationship {
  const mapping = options._mapping;

  if (mapping.skipTargetCreation === undefined) {
    delete mapping.skipTargetCreation;
  }

  const _type = type(
    options.properties,
    options._class,
    'mapping_source',
    mapping.targetEntity._type,
  );

  const relationshipClass = options._class.toUpperCase();

  return {
    _class: relationshipClass,
    _type,
    _mapping: options._mapping,
    _key: key(
      options.properties,
      options._class,
      mapping.sourceEntityKey,
      options._key || mapping.targetEntity._key,
    ),
    displayName: relationshipClass,
    ...options.properties,
  };
}

function createRelationship({
  _class,
  fromType,
  fromKey,
  toType,
  toKey,
  properties,
}: DirectRelationshipLiteralOptions): ExplicitRelationship {
  const relationshipClass = _class.toUpperCase();
  const _type = generateRelationshipType(_class, fromType, toType);
  return {
    _key: `${fromKey}|${_class.toLowerCase()}|${toKey}`,
    _type,
    _class: relationshipClass,
    _fromEntityKey: fromKey,
    _toEntityKey: toKey,
    displayName: relationshipClass,
    ...properties,
  };
}

function key(
  properties: AdditionalRelationshipProperties | undefined,
  _class: string,
  fromKey: string,
  toKey: string | undefined,
): string {
  if (properties && properties._key) {
    return properties._key;
  } else {
    if (!toKey) {
      throw new IntegrationError({
        code: 'MISSING_RELATIONSHIP_TO_KEY',
        message:
          'Without _key provided in properties, _key generation requires mapping.targetEntity._key!',
      });
    }

    return generateRelationshipKey(_class, fromKey, toKey);
  }
}

function type(
  properties: AdditionalRelationshipProperties | undefined,
  _class: string,
  fromType: string,
  toType: string | undefined,
): string {
  if (properties && properties._type) {
    return properties._type;
  } else {
    if (!toType) {
      throw new IntegrationError({
        code: 'MISSING_RELATIONSHIP_TO_TYPE',
        message:
          'Without _type provided in properties, _type generation requires mapping.targetEntity._type!',
      });
    }

    return generateRelationshipType(_class, fromType, toType);
  }
}

/**
 * Relationship `_type` can be generated from the `_type`s of related entities.
 * The relationship `_class` is required to ensure that the relationship `_type`
 * is distinguished from other relationships between entities of the same
 * `_type`s. This supports finding all relationships of a type for the purpose
 * of set synchronization.
 */
export function generateRelationshipType(
  _class: string,
  from: { _type: string } | string,
  to: { _type: string } | string,
): string {
  if (!from || !to) {
    throw new IntegrationError({
      code: 'GENERATE_RELATIONSHIP_TYPE_MISSING_RELATIONSIHP_FROM_OR_TO',
      message:
        '"from" and "to" must be provided to generate a relationship _type!',
    });
  }

  const fromValue = typeof from === 'string' ? from : from._type;
  const toValue = typeof to === 'string' ? to : to._type;

  const fromValueParts = fromValue.split('_');
  const toValueParts = toValue.split('_');

  let i = 0;
  do {
    if (toValueParts[i] === fromValueParts[i]) {
      i++;
    } else {
      break;
    }
  } while (i < toValueParts.length - 1);

  return `${fromValue}_${_class.toLowerCase()}_${toValueParts
    .slice(i)
    .join('_')}`;
}

/**
 * Relationship `_key` can be generated from the `_key`s of related entities.
 * The relationship `_class` is required to ensure that the relationship `_key`
 * is distinguished from other relationships between entities of the same
 * `_key`s.
 */
export function generateRelationshipKey(
  _class: string,
  from: { _key: string } | string,
  to: { _key: string } | string,
): string {
  if (!from || !to) {
    throw new IntegrationError({
      code: 'GENERATE_RELATIONSHIP_KEY_MISSING_RELATIONSHIP_FROM_OR_TO',
      message:
        '"from" and "to" must be provided to generate a relationship _type!',
    });
  }

  const fromValue = typeof from === 'string' ? from : from._key;
  const toValue = typeof to === 'string' ? to : to._key;
  return `${fromValue}|${_class.toLowerCase()}|${toValue}`;
}
