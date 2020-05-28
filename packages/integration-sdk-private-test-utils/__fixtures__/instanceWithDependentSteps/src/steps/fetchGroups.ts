import noop from 'lodash/noop';

export default {
  id: 'fetch-groups',
  name: 'Fetch Groups',
  types: ['my_groups'],
  dependsOn: ['fetch-accounts'],
  executionHandler: noop,
};
