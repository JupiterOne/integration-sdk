import { Entity, ExplicitRelationship } from '@jupiterone/integration-sdk-core';

export interface IntegrationData {
  entities: Entity[];
  relationships: ExplicitRelationship[];
}
