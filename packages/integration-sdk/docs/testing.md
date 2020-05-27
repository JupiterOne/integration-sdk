# Testing Integrations

A JupiterOne integration is expected to produce a graph of entities and
relationships representing the state of something an organization cares about. A
well factored integration is typically composed of three major components:

1. Data source clients authenticate with and collect data from the source
1. Converters transfer source data to graph entity and relationship properties
1. Integration steps combine collection and conversion to build a subset of the
   graph

Data collection code encapsulates authentication and provides functions such as
`iterateUsers`, `iterateGroups`, and `iterateRepositories`, which do nothing
more than paginate the proper endpoint(s) to iterate each major asset of the
source data, and encapsulate response/data loading error handling. This single
responsibility provides an opportunity to extract the code into a client for
general use against the targeted API/data source. The iterator approach should
drive clients to avoid loading complete sets of provider data into memory.

Converter functions take source data and produce an entity or relationship graph
object. These typically wrap up a call to `createIntegrationEntity` or
`createIntegrationRelationship`, which can handle most of the work. However, it
is important to write a test that expresses the expected properties of graph
objects so that the integration remains stable throughout changes to these
helper functions.

Integration steps reflect an understanding of how source data is related and the
order in which data must be obtained. This step architecture allows for
concurrent execution of fetching data that is not related, and sequential
execution of fetching data that depends on other data having already been
fetched. Steps iterate source objects using the data client and converters to
produce entities and relationships, but the steps are responsible for organizing
data collection and entity and relationship construction.

## Integration Testing

Ideal integration testing (ensuring end-to-end success) would:

1. Consistently create data in the source system
1. Execute the integration
1. Verify the expected graph was produced

This can be accomplished by:

1. Scripting source data setup
1. Executing the integration
1. Describing the complete set of entities and relationships

We are looking at ways to make this easy.

## Unit Testing

Strive to isolate unit tests according to:

1. Client authentication and data fetching, including response error handling
1. Converting source data to entity/relationship objects, ensuring properties
   are transferred as expected
1. Producing entities with the right relationships based on a known set of
   source data (do not test properties)

It is recommended that development starts by working out connectivity with the
data source, driving the development of a client that encapsulates
authentication, data fetching, and error handling. Test the client in a way that
allows it to make actual connections and record the responses. This provides a
record of how the data source APIs respond and what the integration is coded to
expect.

These recordings contain real responses that can be **copied into converter
tests**. This allows for manipulating the input data in converter tests to cover
various data scenarios, sometimes to include sample data that customers may
provide which we cannot easily re-produce otherwise.

This approach will require an account and assets created in the data source.
Look for a Terraform provider, or consider writing scripts. At a minimum,
document how to manually create the source data that tests depend on so that
data can be reproduced in the future, saving time on figuring out how to get
content re-created to support existing tests as well as new ones.

Use [Polly.js](https://netflix.github.io/pollyjs) for testing the client code
when you're connecting to an HTTP-based data source. Polly records and plays
back the responses when the unit tests run again. Additional tests can be
written with Polly mock responses in scenarios that cannot be easily reproduced
through real requests (such as intermittant failures we see in production).

Steps are unit tested by controlling the source data and where necessary, the
entities and relationships produced by the steps a step depends on. It is not
necessary to replicate the complete content of the data source, only what is
necessary to prove the step produces the expected subgraph.

`@jupiterone/integration-sdk/testing` provides utilities to simplify unit
testing.

### `createMockExecutionContext`

For simple unit testing of the `getStepStartStates` and the `validateInvocation`
functions, we expose a utility for creating a mock execution context.

This function accepts options to populate the integration instance's `config`
field to help with testing different code paths via the `instanceConfig` option.
If the `instanceConfig` option is not set, the SDK will read the
`src/instanceConfigFields.json` and load in values from environment variables
and the project's `.env` file if present.

If unable to load a config from environment variables, the function will create
a configuration with mock values based the types specified in
`src/instanceConfigFields.json`.

Example `instanceConfigFields.json` file:

```json
{
  "apiKey": {
    "type": "string"
  }
}
```

Usage:

```typescript
// creates a simple execution context with a mocked
// logger and an instance with mocked values
const contextWithGeneratedConfig = createMockExecutionContext();
/**
 * Returns:
 *
 * {
 *   logger: <mockLogger>,
 *   instance: {...<local integration instance>, config: { apiKey: 'STRING_VALUE' } }
 * }
 */

// constructs instance config using environment variables
process.env.API_KEY = 'my-api-key';
const contextWithConfigBuiltFromEnv = createMockExecutionContext();
/**
 * Returns:
 *
 * {
 *   logger: <mockLogger>,
 *   instance: {...<local integration instance>, config: { apiKey: 'my-api-key' } }
 * }
 */

// creates an execution context with a mocked
// logger and instance populated with the input config
const contextWithProvidedInstanceConfig = createMockExecutionContext({
  instanceConfig: {
    apiKey: 'test',
  },
});
/**
 * Returns:
 *
 * {
 *   logger: <mock integration logger>,
 *   instance: {...<local integration instance>, config: { apiKey: 'test' } }
 * }
 */
```

Example usage in a test:

```typescript
import { createMockExecutionContext } from '@jupiterone/integration-sdk/testing';
import getStepStartStates from './getStepStartStates';

test('disables "fetch-accounts" step if "skipAccounts" is set to true on the instance config', () => {
  const context = createMockExecutionContext({
    instanceConfig: {
      apiKey: 'test',
      skipAccounts: true,
    },
  });

  const stepStartStates = getStepStartStates(context);

  expect(getStepStartStates).toEqual({
    'fetch-accounts': {
      disabled: true,
    },
    'other-step': {
      disabled: false,
    },
  });
});
```

#### `createMockStepExecutionContext`

To assist with unit testing steps, we expose a utility for creating a mocked
version of the step execution context.

This version of the context object stores the entities and relationships
collected via the `jobState` in memory.

For convenience, the `jobState` created by the mocked context exposes a slightly
different interface than the regular `jobState` object and allows for data
collected via the `addEntities` and `addRelationships` functions to be accessed
via `collectedEntities` and `collectedRelationships` properties.

Example usage in a test:

```typescript
import step from './my-step';
import { createMockStepExecutionContext } from '@jupiterone/integration-sdk/testing';

test('should generate the expected entities and relationships', () => {
  const entities = [expectedEntityA];
  const relationships = [expectedRelationshipA, expectedRelationshipB];
  const context = createMockStepExecutionContext();

  await step.executionHandler(context);

  expect(context.jobState.collectedEntities).toEqual(entities);
  expect(context.jobState.collectedRelationships).toEqual(relationships);
});
```

This function accepts the same options as `createMockExecutionContext` but also
allows passing `entities` and `relationships`. This is helpful for setting up
tests for steps that rely on data from another step. The `entities` and
`relationships` passed in via the options are _not_ included in the
`collectedEntities` and `collectedRelationships` arrays.

Input data is omitted from the `collected*` properties because step tests should
only have to focus on asserting the generation of new data from based on the
previous set of data.

For example:

```typescript
import step from './my-step';
import { createMockStepExecutionContext } from '@jupiterone/integration-sdk/testing';

test('should generate the expected entities and relationships', () => {
  const previousStepEntities = [entityA];
  const previousStepRelationships = [relationshipA, relationshipB];

  const expectedGeneratedEntities = [expectedEntityA];
  const expectedGeneratedRelationships = [expectedRelationshipA];

  const context = createMockStepExecutionContext({
    entities: previousStepEntities,
    relationships: previousStepRelationships,
  });

  await step.executionHandler(context);

  expect(context.jobState.collectedEntities).toEqual(expectedGeneratedEntities);
  expect(context.jobState.collectedRelationships).toEqual(
    expectedGeneratedRelationships,
  );
});
```

#### `setupRecording`

We highly recommend using [Polly.js](https://netflix.github.io/pollyjs/#/) to
record real responses from a provider for use in tests.

To make using Polly.js easier, we expose a `setupRecording` function that
handles most of the setup for you.

The function accepts a `directory` parameter that will be used to determine
where to place a `__recordings__` directory on disk to house recorded data. A
`name` parameter must be provided and will be used as part of the directory name
for the recordings.

You can optionally provide `redactedRequestHeaders` and
`redactedResponseHeaders` options for redacting headers prior to writing the
data to disk.

For full control over all aspects of an entry's request and response, you can
provide a `mutateEntry` function to make tweaks. This can be helpful for
situations where sensitive data is stored in the response or request's body and
needs to be hidden.

Because `setupRecording` inherits from `setupPolly`, developers can use the
`options` parameter to pass in any configuration parameters available in
[`PollyConfig`](https://github.com/Netflix/pollyjs/blob/master/docs/configuration.md).

Example usage in test:

```typescript
import step from './my-step';
import provider from './myProvider';
import { Recording, setupRecording } from '@jupiterone/integration-sdk/testing';

let recording: Recording;

afterEach(async () => {
  await recording.stop();
});

test('should generate the expected entities and relationships', () => {
  recording = setupRecording({
    name: 'my awesome recording',
    directory: __dirname,
    redactedRequestHeaders: ['api-secret-key'],
    options: {
      recordFailedRequests: true,
      matchRequestsBy: {
        url: {
          query: false,
        },
      },
    },
  });

  const resources = [];
  await provider.iterateThings((e) => {
    resources.push(e);
  });

  expect(resources).toEqual([
    {
      id: expect.any(String),
      name: 'development',
      tags: expect.objectContaining({
        someTag: 'value',
      }),
    },
  ]);
});
```
