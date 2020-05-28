import dotenv from 'dotenv';
import snakeCase from 'lodash/snakeCase';

import {
  IntegrationLocalConfigFieldMissingError,
  IntegrationLocalConfigFieldTypeMismatchError,
  IntegrationInstanceConfig,
  IntegrationInstanceConfigField,
  IntegrationInstanceConfigFieldMap,
} from '@jupiterone/integration-sdk-core';

const dotenvExpand = require('dotenv-expand');

/**
 * Reads integration configuration from environment variables
 */
export function loadConfigFromEnvironmentVariables<
  TConfig extends IntegrationInstanceConfig
>(configMap: IntegrationInstanceConfigFieldMap): TConfig {
  // pull in environment variables from .env file if available
  dotenvExpand(dotenv.config());

  return Object.entries(configMap)
    .map(([field, config]): [string, string | boolean] => {
      const environmentVariableName = snakeCase(field).toUpperCase();

      const environmentVariableValue = process.env[environmentVariableName];

      if (environmentVariableValue === undefined) {
        throw configFieldMissingError(field, environmentVariableName);
      }
      const convertedValue = convertEnvironmentVariableValueForField(
        field,
        config,
        environmentVariableValue,
      );

      return [field, convertedValue];
    })
    .reduce((acc: Record<string, string | boolean>, [field, value]) => {
      acc[field] = value;
      return acc;
    }, {}) as TConfig;
}

function convertEnvironmentVariableValueForField(
  field: string,
  fieldConfig: IntegrationInstanceConfigField,
  environmentVariableValue: string,
): string | boolean {
  let convertedValue: string | boolean;

  switch (fieldConfig.type) {
    case 'boolean': {
      const rawString = environmentVariableValue.toLowerCase();
      if (rawString === 'true') {
        convertedValue = true;
      } else if (rawString === 'false') {
        convertedValue = false;
      } else {
        throw new IntegrationLocalConfigFieldTypeMismatchError(
          `Expected boolean value for field "${field}" but received "${environmentVariableValue}".`,
        );
      }
      break;
    }
    case 'string':
    default:
      convertedValue = environmentVariableValue;
  }
  return convertedValue;
}

function configFieldMissingError(
  field: string,
  environmentVariableName: string,
) {
  throw new IntegrationLocalConfigFieldMissingError(
    `Expected environment variable "${environmentVariableName}" for config field "${field}" to be set.`,
  );
}
