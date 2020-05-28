import { mocked } from 'ts-jest/utils';
import Alpha from '@lifeomic/alpha';
import jwt from 'jsonwebtoken';

import {
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  createApiClientWithApiKey,
} from '../index';

jest.mock('@lifeomic/alpha');
jest.mock('jsonwebtoken');

const AlphaMock = mocked(Alpha);
const decodeJwtMock = mocked(jwt.decode);

describe('getApiBaseUrl', () => {
  test('returns development base url if dev option is set to true', () => {
    expect(getApiBaseUrl({ dev: true })).toEqual(
      'https://api.dev.jupiterone.io',
    );
  });

  test('returns production base url if dev option is set to false', () => {
    expect(getApiBaseUrl({ dev: false })).toEqual(
      'https://api.us.jupiterone.io',
    );
  });

  test('defaults to returning the production base url', () => {
    expect(getApiBaseUrl()).toEqual('https://api.us.jupiterone.io');
  });
});

describe('getApiKeyFromEnvironment', () => {
  beforeEach(() => {
    process.env.JUPITERONE_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_API_KEY;
  });

  test('returns JUPITERONE_API_KEY environment variable value', () => {
    const apiKey = getApiKeyFromEnvironment();

    expect(apiKey).toEqual('test-key');
  });

  test('throws error if JUPITERONE_API_KEY is not set', () => {
    delete process.env.JUPITERONE_API_KEY;
    expect(() => getApiKeyFromEnvironment()).toThrow(
      /JUPITERONE_API_KEY environment variable must be set/,
    );
  });
});

describe('createApiClientWithApiKey', () => {
  test('creates an api client with the Authorization and Lifeomic-Account header populated', () => {
    const apiBaseUrl = getApiBaseUrl();

    decodeJwtMock.mockReturnValue({
      account: 'test-account',
    });

    const client = createApiClientWithApiKey({
      apiBaseUrl,
      apiKey: 'test-key',
    });

    expect(client).toBeInstanceOf(AlphaMock);

    expect(AlphaMock).toHaveReturnedTimes(1);
    expect(AlphaMock).toHaveBeenCalledWith({
      baseURL: apiBaseUrl,
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
        'LifeOmic-Account': 'test-account',
      },
    });
  });

  test('throws error if api key is malformed', () => {
    decodeJwtMock.mockImplementation(() => new Error('Failed to parse'));

    expect(() =>
      createApiClientWithApiKey({
        apiBaseUrl: getApiBaseUrl(),
        apiKey: 'test-key',
      }),
    ).toThrow(/Malformed API Key provided/);
  });

  test('throws error if account cannot be derived from the api key', () => {
    decodeJwtMock.mockReturnValue({});

    expect(() =>
      createApiClientWithApiKey({
        apiBaseUrl: getApiBaseUrl(),
        apiKey: 'test-key',
      }),
    ).toThrow(/Malformed API Key provided/);
  });
});
