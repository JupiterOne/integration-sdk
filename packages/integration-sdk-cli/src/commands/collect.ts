import { createCommand } from 'commander';

import {
  prepareLocalStepCollection,
  executeIntegrationLocally,
} from '@jupiterone/integration-sdk-runtime';

import * as log from '../log';
import { loadConfig } from '../config';

// coercion function to collect multiple values for a flag
const collector = (value: string, arr: string[]) => {
  arr.push(...value.split(','));
  return arr;
};

export function collect() {
  return createCommand('collect')
    .description(
      'Executes the integration and stores the collected data to disk',
    )
    .option(
      '-s, --step <steps>',
      'step(s) to run, comma separated if multiple',
      collector,
      [],
    )
    .option('-V, --disable-schema-validation', 'Disable schema validation')
    .action(async (options) => {
      const enableSchemaValidation = !options.disableSchemaValidation;
      const config = prepareLocalStepCollection(await loadConfig(), options);
      log.info('\nConfiguration loaded! Running integration...\n');
      const results = await executeIntegrationLocally(config, {
        enableSchemaValidation,
      });
      log.displayExecutionResults(results);
    });
}
