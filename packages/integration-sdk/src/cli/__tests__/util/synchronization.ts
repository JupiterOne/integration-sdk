import { Polly } from '@pollyjs/core';
import {
  SynchronizationJob,
  SynchronizationJobStatus,
} from '../../../framework/synchronization';

export { generateSynchronizationJob } from '../../../__tests__/generateSynchronizationJob';

interface SetupOptions {
  baseUrl: string;
  polly: Polly;
  job: SynchronizationJob;
}

export function setupSynchronizerApi({ polly, job, baseUrl }: SetupOptions) {
  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/entities`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.numEntitiesUploaded += JSON.parse(req.body).entities.length;
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/events`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      res.status(200).json({});
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/relationships`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.numRelationshipsUploaded += JSON.parse(req.body).relationships.length;
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/finalize`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.status = SynchronizationJobStatus.FINALIZE_PENDING;
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/abort`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.status = SynchronizationJobStatus.ABORTED;
      res.status(200).json({ job });
    });
}

function allowCrossOrigin(req, res) {
  res.setHeaders({
    'Access-Control-Allow-Origin': req.getHeader('origin'),
    'Access-Control-Allow-Method': req.getHeader(
      'access-control-request-method',
    ),
    'Access-Control-Allow-Headers': req.getHeader(
      'access-control-request-headers',
    ),
  });
}
