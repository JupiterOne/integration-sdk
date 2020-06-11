import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

export interface TimeOperationInput<T extends () => any> {
  logger: IntegrationLogger;
  metricName: string;
  operation: T;
}

export async function timeOperation<T extends () => any>({
  logger,
  metricName,
  operation,
}: TimeOperationInput<T>): Promise<ReturnType<T>> {
  const startTime = Date.now();
  return Promise.resolve(operation()).finally(() => {
    console.log('this was never called');
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.publishMetric({
      metricName,
      unit: 'Milliseconds',
      value: duration,
      timestamp: endTime,
    });
  });
}
