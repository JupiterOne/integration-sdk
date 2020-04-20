const noop = require('lodash/noop');

module.exports = {
  id: 'fetch-accounts',
  name: 'Fetch Accounts',
  types: ['my_account'],
  executionHandler: noop,
};
