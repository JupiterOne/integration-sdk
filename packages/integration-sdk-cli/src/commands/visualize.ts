import { createCommand } from 'commander';

import * as log from '../log';
import { generateVisualization } from '../visualization';

export function visualize() {
  return createCommand('visualize')
    .description('Visualizes the collected data as a graph')
    .option(
      '--data-dir <relative_directory>',
      'The directory used to generate Nodes/Edges for visualization',
      '.j1-integration/graph',
    )
    .action(async (options) => {
      const graphLocation = await generateVisualization(options.dataDir);
      log.info(`Visualize graph here: ${graphLocation}`);
    });
}
