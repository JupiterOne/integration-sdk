import fetchAccounts from './steps/fetchAccounts';
import fetchUsers from './steps/fetchUsers';

import validateInvocation from './validateInvocation';

export const invocationConfig = {
  instanceConfigFields: {
    myConfig: {
      mask: true,
      type: 'boolean',
    },
  },
  integrationSteps: [fetchAccounts, fetchUsers],
  validateInvocation,
};
