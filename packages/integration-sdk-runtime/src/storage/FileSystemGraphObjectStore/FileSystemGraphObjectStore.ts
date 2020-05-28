import pMap from 'p-map';
import { Sema } from 'async-sema';

import {
  Entity,
  Relationship,
  GraphObjectFilter,
  GraphObjectIteratee,
} from '@jupiterone/integration-sdk-core';

import { flushDataToDisk } from './flushDataToDisk';
import { BucketMap } from './BucketMap';

import {
  iterateEntityTypeIndex,
  iterateRelationshipTypeIndex,
} from './indices';

export const GRAPH_OBJECT_BUFFER_THRESHOLD = 500; // arbitrarily selected, subject to tuning

// it is important that this value is set to 1
// to ensure that only one operation can be performed at a time.
const BINARY_SEMAPHORE_CONCURRENCY = 1;

export class FileSystemGraphObjectStore {
  semaphore: Sema;
  entityStorageMap: BucketMap<Entity>;
  relationshipStorageMap: BucketMap<Relationship>;

  constructor() {
    this.entityStorageMap = new BucketMap();
    this.relationshipStorageMap = new BucketMap();

    this.semaphore = new Sema(BINARY_SEMAPHORE_CONCURRENCY);
  }

  async addEntities(storageDirectoryPath: string, newEntities: Entity[]) {
    this.entityStorageMap.add(storageDirectoryPath, newEntities);

    if (this.entityStorageMap.totalItemCount >= GRAPH_OBJECT_BUFFER_THRESHOLD) {
      await this.flushEntitiesToDisk();
    }
  }

  async addRelationships(
    storageDirectoryPath: string,
    newRelationships: Relationship[],
  ) {
    this.relationshipStorageMap.add(storageDirectoryPath, newRelationships);

    if (
      this.relationshipStorageMap.totalItemCount >=
      GRAPH_OBJECT_BUFFER_THRESHOLD
    ) {
      await this.flushRelationshipsToDisk();
    }
  }

  async iterateEntities(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Entity>,
  ) {
    await this.flushEntitiesToDisk();

    await iterateEntityTypeIndex({
      type: filter._type,
      iteratee,
    });
  }

  async iterateRelationships(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Relationship>,
  ) {
    await this.flushRelationshipsToDisk();

    await iterateRelationshipTypeIndex({
      type: filter._type,
      iteratee,
    });
  }

  async flush() {
    await Promise.all([
      this.flushEntitiesToDisk(),
      this.flushRelationshipsToDisk(),
    ]);
  }

  async flushEntitiesToDisk() {
    await this.lockOperation(() =>
      pMap([...this.entityStorageMap.keys()], (storageDirectoryPath) => {
        const entities = this.entityStorageMap.get(storageDirectoryPath) ?? [];
        this.entityStorageMap.delete(storageDirectoryPath);

        return flushDataToDisk({
          storageDirectoryPath,
          collectionType: 'entities',
          data: entities,
        });
      }),
    );
  }

  async flushRelationshipsToDisk() {
    await this.lockOperation(() =>
      pMap([...this.relationshipStorageMap.keys()], (storageDirectoryPath) => {
        const relationships =
          this.relationshipStorageMap.get(storageDirectoryPath) ?? [];
        this.relationshipStorageMap.delete(storageDirectoryPath);

        return flushDataToDisk({
          storageDirectoryPath,
          collectionType: 'relationships',
          data: relationships,
        });
      }),
    );
  }

  /**
   * This function is ensures that only one input operation can
   * happen at a time by utilizing a binary semaphore (lock/unlock).
   *
   * This is used by `flushEntitiesToDisk` and
   * `flushRelationshipsToDisk` to ensure that consumers of this
   * object store wait until all of the currently staged data has been
   * written to disk.
   *
   * Waiting for all data to be flushed is important for
   * maintaining step execution order when
   * flushing data via the `jobState` object.
   *
   * Without some sort of locking mechanism, one step (let's say, step A)
   * could have another step (step B) begin the work of flushing
   * it's data to disk. To prevent duplicate data from being flushed,
   * step B's flush would "claim" the data to write and remove it from
   * the in memory store. Step A would see that there's no work to do
   * and prematurely end, causing the next step to start up before the
   * data it depends on is present on disk.
   */
  async lockOperation(operation: () => Promise<any>) {
    await this.semaphore.acquire();
    try {
      await operation();
    } finally {
      this.semaphore.release();
    }
  }
}
