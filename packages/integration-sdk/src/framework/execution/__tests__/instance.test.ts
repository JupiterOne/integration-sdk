import {
  createIntegrationInstanceForLocalExecution,
  LOCAL_INTEGRATION_INSTANCE,
} from '../instance';
import { v4 as uuid } from 'uuid';

describe('createIntegrationInstanceForLocalExecution', () => {
  beforeEach(() => {
    process.env.MY_FIELD = 'test';
    delete process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID;
  });

  afterEach(() => {
    delete process.env.MY_FIELD;
  });

  test('creates local integration instance with config loaded from env if no instance id is provided', async () => {
    const instance = await createIntegrationInstanceForLocalExecution({
      validateInvocation: jest.fn(),
      integrationSteps: [],
    });

    expect(instance).toEqual(LOCAL_INTEGRATION_INSTANCE);
  });

  test('should allow specifying local JupiterOne account id through environment variable', async () => {
    const accountId = (process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID = uuid());

    const instance = await createIntegrationInstanceForLocalExecution({
      validateInvocation: jest.fn(),
      integrationSteps: [],
    });

    expect(instance).toEqual({
      ...LOCAL_INTEGRATION_INSTANCE,
      accountId,
    });
  });

  test('should load config from env onto instance', async () => {
    const instance = await createIntegrationInstanceForLocalExecution({
      validateInvocation: jest.fn(),
      integrationSteps: [],
      instanceConfigFields: {
        myField: {
          type: 'string',
        },
      },
    });

    expect(instance).toEqual({
      ...LOCAL_INTEGRATION_INSTANCE,
      config: {
        myField: 'test',
      },
    });
  });
});
