import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

export async function timeOperation<T extends () => any>(
  logger: IntegrationLogger,
  metricName: string,
  func: T,
): Promise<T> {
  const startTime = Date.now();
  try {
    return await Promise.resolve(func());
  } finally {
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.publishMetric({
      metricName,
      unit: 'Milliseconds',
      value: duration,
      timestamp: endTime,
    });
  }
}
