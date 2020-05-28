import {
  IntegrationStep,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import { validateStepStartStates } from '../validation';

describe('validateStepStartStates', () => {
  test('throws error if unknown steps are found in start states', () => {
    const states: StepStartStates = {
      a: {
        disabled: false,
      },
      b: {
        disabled: true,
      },
      c: {
        disabled: true,
      },
    };
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => validateStepStartStates(steps, states)).toThrow(
      `Unknown steps found in start states: "b", "c"`,
    );
  });

  test('throws error when steps are not accounted for in start states', () => {
    const states: StepStartStates = {
      a: {
        disabled: false,
      },
    };
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: jest.fn(),
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => validateStepStartStates(steps, states)).toThrow(
      `Start states not found for: "b", "c"`,
    );
  });

  test('passes if all steps are accounted for', () => {
    const states: StepStartStates = {
      a: {
        disabled: false,
      },
    };
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => validateStepStartStates(steps, states)).not.toThrow();
  });
});
