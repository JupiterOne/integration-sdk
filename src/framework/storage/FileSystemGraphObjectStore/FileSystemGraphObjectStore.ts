import pMap from 'p-map';
import { Sema } from 'async-sema';

import { Entity, Relationship } from '../../types';
import { GraphObjectFilter, GraphObjectIteratee } from '../../execution/types';

import { flushDataToDisk } from './flushDataToDisk';
import { BucketMap } from './BucketMap';

import {
  iterateEntityTypeIndex,
  iterateRelationshipTypeIndex,
} from './indices';

export const GRAPH_OBJECT_BUFFER_THRESHOLD = 500; // arbitrarily selected, subject to tuning

interface FileSystemGraphObjectStoreInput {
  cacheDirectory?: string;
}

export class FileSystemGraphObjectStore {
  readonly cacheDirectory?: string;

  semaphore: Sema;
  entityStorageMap: BucketMap<Entity>;
  relationshipStorageMap: BucketMap<Relationship>;

  constructor(options?: FileSystemGraphObjectStoreInput) {
    this.cacheDirectory = options?.cacheDirectory;

    this.entityStorageMap = new BucketMap();
    this.relationshipStorageMap = new BucketMap();

    this.semaphore = new Sema(1);
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
      cacheDirectory: this.cacheDirectory,
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
      cacheDirectory: this.cacheDirectory,
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
    await this.lockOperation(
      () => pMap(
        [...this.entityStorageMap.keys()],
        (storageDirectoryPath) => {
          const entities = this.entityStorageMap.get(storageDirectoryPath) ?? [];
          this.entityStorageMap.delete(storageDirectoryPath);

          return flushDataToDisk({
            storageDirectoryPath,
            cacheDirectory: this.cacheDirectory,
            collectionType: 'entities',
            data: entities,
          });
        },
      )
    )
  }

  async flushRelationshipsToDisk() {
    await this.lockOperation(
      () => pMap(
        [...this.relationshipStorageMap.keys()],
        (storageDirectoryPath) => {
          const relationships = this.relationshipStorageMap.get(storageDirectoryPath) ?? [];
          this.relationshipStorageMap.delete(storageDirectoryPath);

          return flushDataToDisk({
            storageDirectoryPath,
            cacheDirectory: this.cacheDirectory,
            collectionType: 'relationships',
            data: relationships,
          });
        },
      )
    );
  }

  async lockOperation (operation: () => Promise<any>) {
    await this.semaphore.acquire();
    try {
      await operation();
    } finally {
      this.semaphore.release();
    }
  }
}
