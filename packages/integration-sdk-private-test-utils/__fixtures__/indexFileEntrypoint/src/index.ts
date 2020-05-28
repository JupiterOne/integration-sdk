import noop from 'lodash/noop';

export const invocationConfig = {
  instanceConfigFields: {
    myConfig: {
      mask: true,
      type: 'boolean',
    },
  },
  integrationSteps: [
    {
      id: 'fetch-accounts',
      name: 'Fetch Accounts',
      types: ['my_account'],
      executionHandler: noop,
    },
    {
      id: 'fetch-users',
      name: 'Fetch Users',
      types: ['my_user'],
      executionHandler: noop,
    },
  ],
  validateInvocation: noop,
  getStepStartStates: () => ({
    'fetch-accounts': {
      disabled: false,
    },
    'fetch-users': {
      disabled: false,
    },
  }),
};
