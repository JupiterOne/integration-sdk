/**
 * Home of all file system interactions
 *
 * This module exports utilities for writing data
 * relative to the .j1-integration root storage directoryPath.
 */
import * as nodeFs from 'fs';
const fs = nodeFs.promises;
import path from 'path';

import rimraf from 'rimraf';

export const DEFAULT_CACHE_DIRECTORY_NAME = '.j1-integration';

export function getRootStorageDirectory() {
  return (
    process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY ||
    path.resolve(process.cwd(), DEFAULT_CACHE_DIRECTORY_NAME)
  );
}

interface WriteDataToPathInput {
  path: string;
  data: object;
}

/**
 * Function for writing arbirary data to a path
 * relative to the cache directory.
 *
 * This will ensure that the directories exists or have been
 * created prior to writing the file.
 */
export async function writeJsonToPath({
  path: relativePath,
  data,
}: WriteDataToPathInput) {
  await writeFileToPath({
    path: relativePath,
    content: JSON.stringify(data, null, 2),
  });
}

interface WriteContentToPathInput {
  path: string;
  content: string;
}

export async function writeFileToPath({
  path: relativePath,
  content,
}: WriteContentToPathInput) {
  const directory = getRootStorageDirectory();
  const fullPath = path.resolve(directory, relativePath);

  await ensurePathCanBeWrittenTo(fullPath);
  await fs.writeFile(fullPath, content, 'utf8');
}

export async function readJsonFromPath<T>(path: string) {
  const entityJson = await fs.readFile(path, 'utf8');
  return JSON.parse(entityJson) as T;
}

interface SymlinkInput {
  sourcePath: string;
  destinationPath: string;
}

/**
 * Function for creating a symlink from on file to another.
 *
 * This will ensure that the directories exists or have been
 * created prior to writing the file.
 */
export async function symlink({ sourcePath, destinationPath }: SymlinkInput) {
  const directory = getRootStorageDirectory();
  const fullSourcePath = path.resolve(directory, sourcePath);
  const fullDestinationPath = path.resolve(directory, destinationPath);

  await ensurePathCanBeWrittenTo(fullDestinationPath);
  await fs.symlink(fullSourcePath, fullDestinationPath);
}

export interface WalkDirectoryIterateeInput {
  filePath: string;
  data: string;
}

type WalkDirectoryIteratee = (
  input: WalkDirectoryIterateeInput,
) => Promise<void> | void;

interface WalkDirectoryInput {
  path: string;
  iteratee: WalkDirectoryIteratee;
}

/**
 * Function for recursively walking through a directory
 * and reading the data from each file.
 */
export async function walkDirectory({
  path: relativePath,
  iteratee,
}: WalkDirectoryInput) {
  const directory = getRootStorageDirectory();
  const fullPath = path.resolve(directory, relativePath);

  const isDirectory = await isDirectoryPresent(fullPath);
  if (!isDirectory) {
    return;
  }

  const files = await fs.readdir(fullPath);

  const onFile = async (filePath: string) => {
    const data = await fs.readFile(filePath, 'utf8');
    await iteratee({ filePath, data });
  };

  const handleFilePath = async (filePath: string) => {
    const stats = await fs.lstat(filePath);
    if (stats.isDirectory()) {
      // continue walking the directory
      await walkDirectory({
        iteratee,
        path: filePath,
      });
    } else if (stats.isFile()) {
      // handle the file
      await onFile(filePath);
    } else if (stats.isSymbolicLink()) {
      // resolve the symlink then reperform check
      // to determine path resolves to a file or
      // if we should continue recursing
      const realPath = await fs.realpath(filePath);
      await handleFilePath(realPath);
    }
  };

  for (const file of files) {
    await handleFilePath(path.resolve(fullPath, file));
  }
}

/**
 * Wipes the storage directory clean
 */
export async function removeStorageDirectory() {
  const rootStorageDir = getRootStorageDirectory();
  if (await isDirectoryPresent(rootStorageDir)) {
    await removeDirectory(rootStorageDir);
  }
}

function removeDirectory(directory: string) {
  return new Promise((resolve, reject) =>
    rimraf(directory, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    }),
  );
}

async function isDirectoryPresent(fullPath: string) {
  try {
    const stats = await fs.lstat(fullPath);
    return stats.isDirectory();
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }

    // not what we expected... throw error
    throw err;
  }
}

async function ensurePathCanBeWrittenTo(pathToWrite: string) {
  const directoryPath = path.dirname(pathToWrite);
  await fs.mkdir(directoryPath, { recursive: true });
}
