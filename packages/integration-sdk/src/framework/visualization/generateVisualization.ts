import path from 'path';
import { writeFileToPath } from '../../fileSystem';
import { generateVisHTML } from './generateVisHTML';
import { retrieveIntegrationData } from './retrieveIntegrationData';
import { Edge } from 'vis';
import globby from 'globby';
import upath from 'upath';

import * as log from '../../log';

/**
 * Generates visualization of Vertices and Edges using https://visjs.github.io/vis-network/docs/network/
 */
export async function generateVisualization(integrationPath): Promise<string> {
  const resolvedIntegrationPath = path.resolve(process.cwd(), integrationPath);

  const entitiesAndRelationshipPaths = await globby([
    upath.toUnix(`${resolvedIntegrationPath}/**/*.json`),
  ]);

  if (entitiesAndRelationshipPaths.length === 0) {
    log.warn(`Unable to find any files under path: ${resolvedIntegrationPath}`);
  }

  const { entities, relationships } = await retrieveIntegrationData(
    entitiesAndRelationshipPaths,
  );

  const nodeDataSets = entities.map((entity) => ({
    id: entity._key,
    label: entity.displayName,
  }));
  const edgeDataSets = relationships.map(
    (relationship): Edge => ({
      from: relationship._fromEntityKey,
      to: relationship._toEntityKey,
      label: relationship.displayName,
    }),
  );

  const htmlFileLocation = path.join(resolvedIntegrationPath, 'index.html');

  await writeFileToPath({
    path: htmlFileLocation,
    content: generateVisHTML(nodeDataSets, edgeDataSets),
  });

  return htmlFileLocation;
}
