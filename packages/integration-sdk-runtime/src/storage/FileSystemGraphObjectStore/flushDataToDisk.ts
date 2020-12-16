import pMap from 'p-map';
import { v4 as uuid } from 'uuid';
import groupBy from 'lodash/groupBy';

import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

import { writeJsonToPath, symlink } from '../../fileSystem';

import {
  CollectionType,
  buildIndexFilePath,
  buildObjectCollectionFilePath,
} from './path';

interface FlushDataToDiskInput {
  storageDirectoryPath: string;
  collectionType: CollectionType;
  data: Entity[] | Relationship[];
  pretty?: boolean;
}

/**
 * Utility for flushing collected data to disk and
 * creating a symlink in the 'index' directory
 * based on the entity or relationship '_type'.
 */
export async function flushDataToDisk({
  storageDirectoryPath,
  collectionType,
  data,
  pretty,
}: FlushDataToDiskInput) {
  // split the data by type first
  const groupedCollections = groupBy(data, '_type');

  // for each collection, write the data to disk,
  // then symlink to index directory
  await pMap(
    Object.entries(groupedCollections),
    async ([type, collection]) => {
      const filename = generateJsonFilename();
      const graphDataPath = buildObjectCollectionFilePath({
        storageDirectoryPath,
        collectionType,
        filename,
      });
      const indexPath = buildIndexFilePath({ type, collectionType, filename });

      await writeJsonToPath({
        path: graphDataPath,
        data: {
          [collectionType]: collection,
        },
        pretty,
      });

      await symlink({
        sourcePath: graphDataPath,
        destinationPath: indexPath,
      });
    },
    { concurrency: 3 },
  );
}

function generateJsonFilename() {
  return `${uuid()}.json`;
}
