import { PersistedObject } from './persistedObject';
import { Entity } from './entity';

export type Relationship = ExplicitRelationship | MappedRelationship;

export type ExplicitRelationship = PersistedObject &
  RelationshipRequiredProperties &
  RelationshipAdditionalProperties;

interface RelationshipRequiredProperties {
  /**
   * The key that the edge is directed toward.
   */
  _toEntityKey: string;

  /**
   * The key that the edge is directed from.
   */
  _fromEntityKey: string;
}

type RelationshipAdditionalProperties = Record<
  string,
  RelationshipPropertyValue
>;

type RelationshipPropertyValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | RelationshipMapping;

export type TargetFilterKey = string | string[];
export type TargetEntityProperties = Partial<Entity>;

/**
 * Relationship direction.
 * `FORWARD` is from source to target.
 * `REVERSE` is from target to source.
 */
export enum RelationshipDirection {
  FORWARD = 'FORWARD',
  REVERSE = 'REVERSE',
}

/**
 * A relationship between an entity managed by the integration, and an entity
 * that may be managed by a different integration or may not be known to any
 * integration.
 */
export interface MappedRelationship
  extends Omit<ExplicitRelationship, '_fromEntityKey' | '_toEntityKey'> {
  /**
   * Metadata providing properties for finding or creating the other side of the
   * relationship.
   *
   * The `_mapping` indicates the desire to have the downstream mapper create a
   * relationship to entities that already exist, or when no matching entities
   * are found, the mapper will create one using the `targetEntity` properties.
   * When the mapper owns the target entity, because it created it for one
   * integration or another, it will update the entity with properties known by
   * this integration.
   */
  _mapping: RelationshipMapping;
}

/**
 * Metadata assigned to a `MappedRelationshipFromIntegration._mapping`.
 */
export interface RelationshipMapping {
  /**
   * The relationship direction, `source - FORWARD -> target` or
   * `source <- REVERSE - target`.
   */
  relationshipDirection: RelationshipDirection;

  /**
   * The `_key` value of the entity managed by the integration, to which
   * relationships will be created.
   *
   * "Source" implies that the graph vertex will have an outgoing edge. However,
   * that is not necessarily the case. See `relationshipDirection`.
   */
  sourceEntityKey: string;

  /**
   * Identifies properties in the `targetEntity` that are used to locate the
   * entites to connect to the `sourceEntityKey`. For example, if you know that
   * you want to build a relationship to user entities with a known email, this
   * can be expressed by:
   *
   * ```js
   * {
   *   targetFilterKeys: [['_class', 'email']],
   *   targetEntity: {
   *     _class: 'User',
   *     email: 'person@example.com',
   *     firstName: 'Person',
   *     lastName: 'Example'
   *   }
   * }
   */
  targetFilterKeys: TargetFilterKey[];

  /**
   * Properties of the target entity known to the integration building the
   * relationship.
   *
   * The property values of the `targetFilterKeys` are used to find the target
   * entities. When the mapper manages the target entity (it created the entity,
   * no other integration owns it), it will update the entity to store these
   * properties. This allows a number of integrations to contribute data to
   * "fill out" knowledge of the entity.
   */
  targetEntity: TargetEntityProperties;

  /**
   * By default, an entity will be created by the mapper when no matching
   * entities are found.
   *
   * When a relationship is not meaningful unless target entities already exist,
   * `skipTargetCreation: true` will inform the mapper that the entity should
   * not be created.
   */
  skipTargetCreation?: boolean;
}
