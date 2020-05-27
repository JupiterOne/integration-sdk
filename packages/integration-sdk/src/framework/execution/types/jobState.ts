import { Entity, Relationship } from '../../types';

export interface GraphObjectFilter {
  _type: string;
}

export type GraphObjectIteratee<T> = (obj: T) => void | Promise<void>;

/**
 * The `JobState` is used to store and retrieve entities and relationships
 * during the execution of an integration. Any step may add objects and
 * dependent steps executed later may load them to build relationships or
 * additional entities.
 */
export interface JobState {
  /**
   * Store arbitrary data for use in dependent steps.
   *
   * Integrations often need a means of storing some information other than
   * entities and relationships for use across steps. This simple mechanism
   * makes no asumptions about the content of the data, and a single value can
   * be stored per key, though the value can be as complex as necessary.
   *
   * This mechanism is not meant to replace storage and retrieval of
   * entities/relationships across steps. That is, this mechanism is for smaller
   * amounts of transient data.
   */
  setData: <T>(key: string, data: T) => Promise<void>;

  /**
   * Retrieve arbitrary data stored by parent steps.
   *
   * Keep in mind that steps are executed in an order that respects the step
   * dependency graph. A step will only see the data stored in previous steps it
   * depends on. Other steps outside the dependency ancestry may not have run
   * and therefore data collected by those other steps should not be expected to
   * exist.
   *
   * @see setData
   */
  getData: <T>(key: string) => Promise<T>;

  /**
   * Adds an entity to the job's collection. `addEntities` can be used
   * to add a batch of entities to the collection.
   */
  addEntity: (entity: Entity) => Promise<void>;

  /**
   * Adds a batch of entities to the job's collection. `addEntity` can be used
   * to add a single entity to the collection.
   */
  addEntities: (entities: Entity[]) => Promise<void>;

  /**
   * Adds a relationship to the job's collection. `addRelationships` can be used
   * to add a batch of relationships to the collection.
   */
  addRelationship: (relationship: Relationship) => Promise<void>;

  /**
   * Adds a batch of relationships to the job's collection. `addRelationship` can be used
   * to add a single relationship to the collection.
   */
  addRelationships: (relationships: Relationship[]) => Promise<void>;

  /**
   * Allows a step to iterate all entities collected into the job state, limited
   * to those that match the provided `filter`.
   *
   * Keep in mind that steps are executed in an order that respects the step
   * dependency graph. A step will only see the entities collected in previous
   * steps it depends on. Other steps outside the dependency ancestry may not
   * have run and therefore entities collected by those other steps should not
   * be expected to exist.
   */
  iterateEntities: (
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Entity>,
  ) => Promise<void>;

  /**
   * Allows a step to iterate all relationships collected into the job state,
   * limited to those that match the provided `filter`.
   *
   * Keep in mind that steps are executed in an order that respects the step
   * dependency graph. A step will only see the relationships collected in
   * previous steps it depends on. Other steps outside the dependency ancestry
   * may not have run and therefore relationships collected by those other steps
   * should not be expected to exist.
   */
  iterateRelationships: (
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Relationship>,
  ) => Promise<void>;

  /**
   * Ensures all current state is written to persistent storage. It is not
   * necessary to invoke this in an integration; the state is periodically
   * flushed to reduce memory consumption.
   */
  flush: () => Promise<void>;
}
