import chalk from 'chalk';
import noop from 'lodash/noop';
import * as log from '../log';

import { StepResultStatus } from '../framework';

test("displays extraneous and undeclared types from a step's result", () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(noop);

  log.displayExecutionResults({
    integrationStepResults: [
      {
        id: 'step-a',
        name: 'Step A',
        declaredTypes: ['test_a', 'test_b'],
        encounteredTypes: ['test_a', 'test_c'],
        status: StepResultStatus.SUCCESS,
      },
    ],
    metadata: {
      partialDatasets: {
        types: [],
      },
    },
  });

  expect(consoleSpy).toHaveBeenCalledWith(
    chalk.yellow(
      `The following types were encountered but are not declared in the step's "types" field:\n  - test_c`,
    ),
  );

  expect(consoleSpy).toHaveBeenCalledWith(
    chalk.yellow(
      `\nUndeclared types were detected!
To ensure that integration failures do not cause accidental data loss,
please ensure that all known entity and relationship types
collected by a step are declared in the step's "types" field.`,
    ),
  );
});
