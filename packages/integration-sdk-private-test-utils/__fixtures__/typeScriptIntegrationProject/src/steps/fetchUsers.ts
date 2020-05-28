import {
  IntegrationStepExecutionContext,
  createIntegrationEntity,
  createIntegrationRelationship,
} from '@jupiterone/integration-sdk-core';

export default {
  id: 'fetch-users',
  name: 'Fetch Users',
  types: ['my_user', 'my_account_has_user'],
  executionHandler: async ({
    jobState,
  }: IntegrationStepExecutionContext<{}>) => {
    await jobState.addEntities([
      createIntegrationEntity({
        entityData: {
          source: {
            id: '12345',
            name: 'User 12345',
            description: 'User 12345',
            username: 'foo@email.com',
          },
          assign: {
            _key: 'user:12345',
            _type: 'my_user',
            _class: 'User',
          },
        },
      }),
    ]);
    await jobState.addRelationships([
      createIntegrationRelationship({
        _class: 'HAS',
        fromKey: 'account:1234',
        fromType: 'my_account',
        toKey: 'user:12345',
        toType: 'my_user',
      }),
    ]);
  },
};
