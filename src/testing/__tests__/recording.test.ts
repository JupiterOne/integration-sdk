import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';

import { vol } from 'memfs';
import fetch from 'node-fetch';
import getPort from 'get-port';

import { toUnixPath } from 'test/util';

import { Recording, setupRecording } from '../recording';

// mock fs so that we don't store recordings
jest.mock('fs');

let recording: Recording;
let server;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.close();
});

afterEach(() => {
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

async function startServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
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
