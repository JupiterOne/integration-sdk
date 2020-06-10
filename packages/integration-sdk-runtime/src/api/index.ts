import { AxiosInstance } from 'axios';
import Alpha from '@lifeomic/alpha';
import { malformedApiKeyError, apiKeyRequiredError } from './error';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

export type ApiClient = AxiosInstance;

const jwt = require('jsonwebtoken');

interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
}

interface ApiKeyToken {
  account: string;
}

interface CreateApiClientFromApiKeyInput {
  apiBaseUrl: string;
  apiKey: string;
}

/**
 * Creates an API client using an API key
 */
export function createApiClientWithApiKey({
  apiBaseUrl,
  apiKey,
}: CreateApiClientFromApiKeyInput) {
  const account = extractAccountFromApiKey(apiKey);
  return createApiClient({
    apiBaseUrl,
    account,
    accessToken: apiKey,
  });
}

/**
 * Extracts the account from the api key
 */
function extractAccountFromApiKey(apiKey: string): string {
  let token: ApiKeyToken;
  try {
    token = jwt.decode(apiKey);
  } catch (err) {
    throw malformedApiKeyError();
  }

  const { account } = token;

  if (!account) {
    throw malformedApiKeyError();
  }

  return account;
}

/**
 * Configures an api client for hitting JupiterOne APIs.
 *
 * This function is rather generic and allows for
 * different apiBaseUrls to be provided.
 *
 * In managed environments, this can be configured to
 * hit public and private JupiterOne APIs.
 */
export function createApiClient({
  apiBaseUrl,
  account,
  accessToken,
}: CreateApiClientInput): ApiClient {
  const headers: Record<string, string> = {
    'LifeOmic-Account': account,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return new Alpha({
    baseURL: apiBaseUrl,
    headers,
  }) as ApiClient;
}

interface GetApiBaseUrlInput {
  dev: boolean;
}

export function getApiBaseUrl({ dev }: GetApiBaseUrlInput = { dev: false }) {
  if (dev) {
    return 'https://api.dev.jupiterone.io';
  }

  return 'https://api.us.jupiterone.io';
}

export function getApiKeyFromEnvironment(): string {
  dotenvExpand(dotenv.config());

  const apiKey = process.env.JUPITERONE_API_KEY;

  if (!apiKey) {
    throw apiKeyRequiredError();
  }

  return apiKey;
}
