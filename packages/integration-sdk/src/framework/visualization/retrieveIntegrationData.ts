import { Entity, ExplicitRelationship } from '../types';
import { readJsonFromPath } from '../../fileSystem';
import { IntegrationData } from './types/IntegrationData';

/**
 * Retrieve integration data from the JSON files from the specified path, defaults to .j1-integration/graph
 */
export async function retrieveIntegrationData(
  entitiesAndRelationshipPaths: string[],
): Promise<IntegrationData> {
  const entities: Entity[] = [];
  const relationships: ExplicitRelationship[] = [];

  const entitiesAndRelationships = await Promise.all(
    entitiesAndRelationshipPaths.map(
      async (path): Promise<any> => {
        return await readJsonFromPath<any>(path);
      },
    ),
  );

  for (const item of entitiesAndRelationships) {
    if (typeof item === 'object') {
      if (item.entities && Array.isArray(item.entities)) {
        entities.push(...item.entities);
      }

      if (item.relationships && Array.isArray(item.relationships)) {
        relationships.push(
          ...item.relationships.filter(
            (relationship) =>
              typeof relationship === 'object' && !relationship._mapping,
          ),
        );
      }
    }
  }

  return {
    entities,
    relationships,
  };
}
