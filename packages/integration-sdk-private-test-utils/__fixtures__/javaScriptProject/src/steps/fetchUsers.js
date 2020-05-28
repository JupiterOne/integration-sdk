const noop = require('lodash/noop');

module.exports = {
  id: 'fetch-users',
  name: 'Fetch Users',
  types: ['my_user'],
  executionHandler: noop,
};
