export enum SynchronizationJobStatus {
  AWAITING_UPLOADS = 'AWAITING_UPLOADS',
  FINALIZE_PENDING = 'FINALIZE_PENDING',
  FINALIZING_ENTITIES = 'FINALIZING_ENTITIES',
  FINALIZING_RELATIONSHIPS = 'FINALIZING_RELATIONSHIPS',
  ABORTED = 'ABORTED',
  FINISHED = 'FINISHED',
  UNKNOWN = 'UNKNOWN',
  ERROR_BAD_DATA = 'ERROR_BAD_DATA',
}

export interface SynchronizationJob {
  id: string;
  integrationJobId: string;
  integrationInstanceId: string;
  status: SynchronizationJobStatus;
  startTimestamp: number;
  numEntitiesUploaded: number;
  numEntitiesCreated: number;
  numEntitiesUpdated: number;
  numEntitiesDeleted: number;
  numRelationshipsUploaded: number;
  numRelationshipsCreated: number;
  numRelationshipsUpdated: number;
  numRelationshipsDeleted: number;
}

export interface SynchronizatoinApiErrorResponse {
  error?: {
    code?: string;
    message: string;
  };
}
