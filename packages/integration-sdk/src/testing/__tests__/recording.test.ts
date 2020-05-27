import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';

import { vol } from 'memfs';
import fetch from 'node-fetch';
import getPort from 'get-port';

import { toUnixPath } from '../../__tests__/toUnixPath';

import { Recording, setupRecording } from '../recording';

// mock fs so that we don't store recordings
jest.mock('fs');

let recording: Recording;
let server;

beforeEach(async () => {
  server = await startServer();
});

afterEach(async () => {
  await server.close();
  recording.stop();
  vol.reset();
});

test('create files relative to the recording directory based on the input name', async () => {
  const name = 'testing-name-test-test';
  recording = setupRecording({
    name,
    directory: __dirname,
  });

  await fetch(`http://localhost:${server.port}`);

  await recording.stop();

  expect(Object.keys(vol.toJSON())).toHaveLength(1);

  const [recordingPath] = Object.keys(vol.toJSON());

  expect(
    recordingPath.startsWith(
      toUnixPath(path.resolve(__dirname, '__recordings__', name)),
    ),
  ).toEqual(true);
});

test('accepts recordFailedRequests PollyConfig option', async () => {
  // start new server which responds with statusCode=404
  server.close();
  server = await startServer(404);

  const name = 'test-record-failed-requests';
  recording = setupRecording({
    name,
    directory: __dirname,
    options: {
      recordFailedRequests: true,
    },
  });

  await fetch(`http://localhost:${server.port}`);

  await recording.stop();

  expect(Object.keys(vol.toJSON())).toHaveLength(1);

  const [recordingPath] = Object.keys(vol.toJSON());

  expect(
    recordingPath.startsWith(
      toUnixPath(path.resolve(__dirname, '__recordings__', name)),
    ),
  ).toEqual(true);
});

test('redacts cookies from responses', async () => {
  recording = setupRecording({
    name: 'test',
    directory: __dirname,
  });

  await fetch(`http://localhost:${server.port}`);
  await recording.stop();

  const har = await getRecording();

  expect(har.log.entries[0].response.cookies).toContainEqual(
    expect.objectContaining({
      name: 'cookies',
      value: '[REDACTED]',
    }),
  );

  expect(har.log.entries[0].response.headers).toContainEqual(
    expect.objectContaining({
      name: 'set-cookie',
      value: '[REDACTED]',
    }),
  );
});

test('always redacts headers that are well known sensitive headers', async () => {
  recording = setupRecording({
    name: 'test',
    directory: __dirname,
  });

  await fetch(`http://localhost:${server.port}`, {
    headers: {
      authorization: 'Bearer MyToken',
    },
  });

  await recording.stop();

  const har = await getRecording();

  expect(har.log.entries[0].request.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'authorization',
        value: '[REDACTED]',
      }),
    ]),
  );
});

test('redacts headers based on input', async () => {
  recording = setupRecording({
    name: 'test',
    directory: __dirname,
    redactedRequestHeaders: ['secret-a', 'secret-b'],
    redactedResponseHeaders: ['my-secret-header', 'my-other-secret-header'],
  });

  await fetch(`http://localhost:${server.port}`, {
    headers: {
      'secret-a': 'oooh a secret',
      'secret-b': 'oooh another secret',
    },
  });

  await recording.stop();

  const har = await getRecording();

  expect(har.log.entries[0].request.headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'secret-a',
        value: '[REDACTED]',
      }),
      expect.objectContaining({
        name: 'secret-b',
        value: '[REDACTED]',
      }),
    ]),
  );

  expect(har.log.entries[0].response.headers).toEqual(
    expect.arrayContaining([
      {
        name: 'my-secret-header',
        value: '[REDACTED]',
      },
      {
        name: 'my-other-secret-header',
        value: '[REDACTED]',
      },
      {
        name: 'my-not-so-secret-header',
        value: 'nothing important here',
      },
    ]),
  );
});

test('allows for entries to be mutated via mutateEntry function', async () => {
  const mutateEntry = jest.fn((entry) => {
    // remove all headers
    entry.response.headers = [];
    entry.request.headers = [];
  });

  recording = setupRecording({
    name: 'test',
    directory: __dirname,
    mutateEntry,
  });

  await fetch(`http://localhost:${server.port}`, {
    headers: {
      'secret-a': 'oooh a secret',
      'secret-b': 'oooh another secret',
    },
  });

  await recording.stop();

  const har = await getRecording();

  expect(har.log.entries[0].response.headers).toEqual([]);
  expect(har.log.entries[0].request.headers).toEqual([]);
});

test('allows for overriding matchRequestBy options with deepDefault', async () => {
  recording = setupRecording({
    name: 'test',
    directory: __dirname,
    options: {
      matchRequestsBy: {
        order: false,
        url: {
          query: false,
        },
      },
    },
  });

  await fetch(`http://localhost:${server.port}/query?q=1`);
  await fetch(`http://localhost:${server.port}/query?q=2`);
  await recording.stop();

  const har = await getRecording();
  expect(har.log.entries).toHaveLength(1);
});

test('allows mutating a request preflight changing what is stored in the har file.', async () => {
  const header = 'test-header';
  const headerVal = 'oh hai';
  recording = setupRecording({
    name: 'test',
    directory: __dirname,
    options: {
      matchRequestsBy: {
        order: false,
        url: {
          query: false,
        },
      },
    },
    mutateRequest: (request) => {
      const [incomingHeaderVal] = request.getHeader(header);
      // un gzip the body so polly can save it.
      if (incomingHeaderVal === headerVal) {
        request.body = 'mutated';
      }
    },
  });

  await fetch(`http://localhost:${server.port}`, {
    method: 'post',
    body: 'not mutated',
    headers: {
      [header]: headerVal,
    },
  });
  await recording.stop();

  const har = await getRecording();
  expect(har.log.entries).toHaveLength(1);
  expect(
    har.log.entries.some((e: any) => e.request.postData.text === 'mutated'),
  ).toEqual(true);
});

async function startServer(statusCode?: number) {
  const recordingStatusCode = statusCode ?? 200;
  const server = http.createServer((req, res) => {
    res.writeHead(recordingStatusCode, {
      'content-type': 'application/json',
      'set-cookie': 'cookies=taste-good',
      'my-secret-header': 'super secret',
      'my-other-secret-header': 'super super secret',
      'my-not-so-secret-header': 'nothing important here',
    });
    res.write(JSON.stringify({ test: true }));
    res.end();
  });

  const port = await getPort();
  server.listen(port);

  return {
    close: () => new Promise((resolve) => server.close(resolve)),
    port,
  };
}

async function getRecording() {
  const [recordingPath] = Object.keys(vol.toJSON());

  const rawRecording = await fs.readFile(recordingPath, 'utf8');

  return JSON.parse(rawRecording);
}
