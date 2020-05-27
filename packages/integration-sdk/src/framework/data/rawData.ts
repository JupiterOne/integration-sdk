import { IntegrationError } from '../../errors';
import { EntityRawData, RawDataTracking } from '../types';

/**
 * Get the raw data having 'name`, if any, associated with the `trackingEntity`.
 *
 * @param trackingEntity entity data is associated with
 * @param name name of raw data, unique within scope of entity; `'default'`
 * unless otherwise specified
 */
export function getRawData<T>(
  trackingEntity: RawDataTracking,
  name: string = 'default',
): T | undefined {
  if (!trackingEntity._rawData || trackingEntity._rawData.length === 0) {
    return undefined;
  }

  for (const rawData of trackingEntity._rawData) {
    if (rawData.name === name) {
      return rawData.rawData;
    }
  }
}

/**
 * Associate raw `data` with the `trackingEntity`.
 *
 * @param trackingEntity entity to associate data with
 * @param data raw data to associate; name must be unique within scope of entity
 * @throws Error when a duplicate name is encountered
 */
export function setRawData(
  trackingEntity: RawDataTracking,
  data: EntityRawData,
) {
  if (!trackingEntity._rawData) {
    trackingEntity._rawData = [];
  }

  const existingRawData = getRawData(trackingEntity, data.name);
  if (existingRawData) {
    throw new Error(`Duplicate raw data name '${data.name}'!`);
  }

  trackingEntity._rawData.push(data);
}

/**
 * Validates collection of raw data, throwing an error when invalid.
 *
 * @param trackingEntity entity with _rawData
 * @throws Error when a duplicate name is encountered
 */
export function validateRawData(trackingEntity: RawDataTracking): void {
  if (trackingEntity._rawData) {
    const names = new Set<string>();
    for (const data of trackingEntity._rawData) {
      if (names.has(data.name)) {
        throw new IntegrationError({
          code: 'DUPLICATE_RAW_DATA_NAME',
          message: `Duplicate raw data name '${data.name}'!`,
        });
      } else {
        names.add(data.name);
      }
    }
  }
}
