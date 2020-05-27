import path from 'path';
import {
  loadModuleContent,
  loadInstanceConfigFields,
  loadIntegrationSteps,
  loadValidateInvocationFunction,
  loadGetStepStartStatesFunction,
  loadConfig,
} from '../config';

import {
  loadProjectStructure,
  getProjectDirectoryPath,
  restoreProjectStructure,
} from '../../__tests__/loadProjectStructure';

import * as log from '../../log';

jest.mock('../../log');

afterEach(() => {
  restoreProjectStructure();
});

describe('loadModuleContent', () => {
  test('loads any module and retrieves the default export', () => {
    loadProjectStructure('typeScriptProject');
    expect(
      loadModuleContent(
        path.resolve(process.cwd(), 'src', 'validateInvocation'),
      ),
    ).toEqual(expect.any(Function));
  });
});

describe('loadConfig', () => {
  test('allows for a project directory to be used for loading configs', async () => {
    const typescriptProjectPath = getProjectDirectoryPath('typeScriptProject');

    expect(path.resolve(process.cwd(), 'src')).not.toEqual(
      typescriptProjectPath,
    );

    const config = await loadConfig(path.resolve(typescriptProjectPath, 'src'));

    expect(config).toEqual({
      instanceConfigFields: {
        myConfig: {
          mask: true,
          type: 'boolean',
        },
      },
      getStepStartStates: expect.any(Function),
      validateInvocation: expect.any(Function),
      integrationSteps: [
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          types: ['my_account'],
          executionHandler: expect.any(Function),
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          types: ['my_user'],
          executionHandler: expect.any(Function),
        },
      ],
    });
  });

  test('logs deprecation message for projects with directory structure', async () => {
    const typescriptProjectPath = getProjectDirectoryPath('typeScriptProject');

    await loadConfig(path.resolve(typescriptProjectPath, 'src'));

    const warnSpy = jest.spyOn(log, 'warn');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /Automatically loading configurations from a directory structure is deprecated/,
      ),
    );
  });
});

describe('TypeScript project', () => {
  beforeEach(() => {
    loadProjectStructure('typeScriptProject');
  });

  describe('loadInstanceConfigFields', () => {
    test('loads "src/instanceConfigFields.json" relative to current working directory', () => {
      const instanceConfigFields = loadInstanceConfigFields();
      expect(instanceConfigFields).toEqual({
        myConfig: {
          mask: true,
          type: 'boolean',
        },
      });
    });

    test('returns undefined if module is not found', () => {
      jest
        .spyOn(process, 'cwd')
        .mockReturnValue('/directory/that/does/not/exist/lolololol');

      const instanceConfigFields = loadInstanceConfigFields();
      expect(instanceConfigFields).toBeUndefined();
    });
  });

  describe('loadIntegrationSteps', () => {
    test('loads all files stored in "src/steps" ', async () => {
      const steps = await loadIntegrationSteps();
      expect(steps).toEqual([
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          types: ['my_account'],
          executionHandler: expect.any(Function),
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          types: ['my_user'],
          executionHandler: expect.any(Function),
        },
      ]);
    });
  });

  describe('loadValidateInvocationFunction', () => {
    test('loads function from "src/validateInvocation" ', async () => {
      const validateFunction = loadValidateInvocationFunction();
      expect(validateFunction).toEqual(expect.any(Function));
      expect((validateFunction as any)()).toEqual('loaded');
    });
  });

  describe('loadGetStepStartStatesFunction', () => {
    test('loads function from "src/getStepStartStates" ', async () => {
      const getStepStartStates = loadGetStepStartStatesFunction();
      expect(getStepStartStates).toEqual(expect.any(Function));

      expect((getStepStartStates as any)()).toEqual({
        'fetch-accounts': {
          disabled: false,
        },
        'fetch-users': {
          disabled: false,
        },
      });
    });
  });

  describe('loadConfig', () => {
    test('loads steps, getStepStartStates, validateFunction, and instanceConfigFields', async () => {
      const config = await loadConfig();

      expect(config).toEqual({
        instanceConfigFields: {
          myConfig: {
            mask: true,
            type: 'boolean',
          },
        },
        getStepStartStates: expect.any(Function),
        validateInvocation: expect.any(Function),
        integrationSteps: [
          {
            id: 'fetch-accounts',
            name: 'Fetch Accounts',
            types: ['my_account'],
            executionHandler: expect.any(Function),
          },
          {
            id: 'fetch-users',
            name: 'Fetch Users',
            types: ['my_user'],
            executionHandler: expect.any(Function),
          },
        ],
      });
    });
  });
});

describe('JavaScript projects', () => {
  beforeEach(() => {
    loadProjectStructure('javaScriptProject');
  });

  test('loads steps, getStepStartStates, validateFunction, and instanceConfigFields', async () => {
    const config = await loadConfig();

    expect(config).toEqual({
      instanceConfigFields: {
        myConfig: {
          mask: true,
          type: 'boolean',
        },
      },
      getStepStartStates: expect.any(Function),
      validateInvocation: expect.any(Function),
      integrationSteps: [
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          types: ['my_account'],
          executionHandler: expect.any(Function),
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          types: ['my_user'],
          executionHandler: expect.any(Function),
        },
      ],
    });
  });
});

describe('loading config from src/index file', () => {
  test('loads steps, getStepStartStates, validateFunction, and instanceConfigFields', async () => {
    loadProjectStructure('indexFileEntrypoint');
    const config = await loadConfig();

    expect(config).toEqual({
      instanceConfigFields: {
        myConfig: {
          mask: true,
          type: 'boolean',
        },
      },
      getStepStartStates: expect.any(Function),
      validateInvocation: expect.any(Function),
      integrationSteps: [
        {
          id: 'fetch-accounts',
          name: 'Fetch Accounts',
          types: ['my_account'],
          executionHandler: expect.any(Function),
        },
        {
          id: 'fetch-users',
          name: 'Fetch Users',
          types: ['my_user'],
          executionHandler: expect.any(Function),
        },
      ],
    });
  });

  test('throws error if module does expose configuration as "invocationConfig" export', async () => {
    loadProjectStructure('indexFileEntrypointFailure');

    await expect(loadConfig()).rejects.toThrow(
      /Configuration should be exported as "invocationConfig"/,
    );
  });
});

describe('ts-node loading', () => {
  let tsNodeRequired;

  beforeEach(() => {
    tsNodeRequired = false;

    jest.doMock('ts-node/register/transpile-only', () => {
      tsNodeRequired = true;
      return {};
    });
  });

  test('loads ts-node for typescript projects', async () => {
    loadProjectStructure('typeScriptProject');
    await loadConfig();
    expect(tsNodeRequired).toEqual(true);
  });

  test('does not load ts-node for javascript projects', async () => {
    loadProjectStructure('javaScriptProject');
    await loadConfig();
    expect(tsNodeRequired).toEqual(false);
  });
});
