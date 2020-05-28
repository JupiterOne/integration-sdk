import { createHash } from 'crypto';

import camelCase from 'lodash/camelCase';

const TRUE_REGEX = /^true$/i;
const FALSE_REGEX = /^false$/i;
const BASE10_NUMBER_REGEX = /^\d+$/;
const FLOAT_NUMBER_REGEX = /^\d+\.\d+$/;

export function convertPropertyValue(value: string | undefined) {
  if (!value) {
    return value;
  }
  if (TRUE_REGEX.test(value)) {
    return true;
  }
  if (FALSE_REGEX.test(value)) {
    return false;
  }
  if (BASE10_NUMBER_REGEX.test(value)) {
    return parseInt(value, 10);
  }
  if (FLOAT_NUMBER_REGEX.test(value)) {
    return parseFloat(value);
  }
  return value;
}

export function convertProperties(
  object: any = {},
  options: {
    stringifyObject?: boolean;
    stringifyArray?: boolean;
    parseString?: boolean;
    prefix?: string;
  } = {},
) {
  const supportedTypes = ['string', 'boolean', 'number'];
  const flattenedObject: any = {};

  for (const [key, value] of Object.entries(object)) {
    const newKey =
      options.prefix && options.prefix.length > 0
        ? `${options.prefix}.${camelCase(key)}`
        : camelCase(key);

    if (typeof value === 'boolean' || typeof value === 'number') {
      flattenedObject[newKey] = value;
    } else if (typeof value === 'string') {
      flattenedObject[newKey] = options.parseString
        ? convertPropertyValue(value)
        : value;
    } else if (Array.isArray(value)) {
      if (options.stringifyArray) {
        flattenedObject[newKey] = JSON.stringify(value);
      } else {
        const items: string[] | boolean[] | number[] = value.map((v) => {
          if (supportedTypes.includes(typeof v)) {
            return v;
          } else if (options.stringifyObject) {
            return JSON.stringify(v);
          }
        });
        if (items.length > 0) {
          flattenedObject[newKey] = items;
        }
      }
    } else if (options.stringifyObject) {
      flattenedObject[newKey] = JSON.stringify(value);
    }
  }

  return flattenedObject;
}

interface NameValuePair {
  name?: string;
  value?: string;
  Name?: string;
  Value?: string;
}

export function convertNameValuePairs(
  data: NameValuePair[] | undefined,
  options: {
    parseString?: boolean;
    prefix?: string;
  } = {},
) {
  const obj: any = {};
  for (const item of data || []) {
    const n = item.name || item.Name;
    const v = item.value || item.Value;
    if (n && v) {
      const key =
        options.prefix && options.prefix.length > 0
          ? `${options.prefix}.${camelCase(n)}`
          : camelCase(n);
      const value = options.parseString ? convertPropertyValue(v) : v;
      obj[key] = value;
    }
  }
  return obj;
}

export function getTime(
  time: Date | string | number | undefined,
): number | undefined {
  return time ? new Date(time).getTime() : undefined;
}

/**
 * @description calculates the base64 sha256 hash of the
 * stringified object
 * @param object object to hash stringified version of
 */
export function sha256(object: object | string): string {
  const data = JSON.stringify(object);
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('base64');
}
