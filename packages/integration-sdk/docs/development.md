# Integration development

This project exposes both a framework for constructing integrations and a CLI to
assist with collecting and publishing data with JupiterOne.

For the purpose of synchronizing data, developers only need to collect the "new
state of the world" from a provider and have the data sent to JupiterOne. Data
that was sent up will be diffed against JupiterOne's understanding of the
"world" and persisted via a background process.

## The integration framework

This SDK supports building JupiterOne integrations using either JavaScript or
TypeScript. The execution process expects the integration to produce an object
conforming to the `IntegrationInvocationConfig` interface:

```typescript
export const invocationConfig: IntegrationInvocationConfig = {
  instanceConfigFields: {
    clientId: {
      type: 'string',
      mask: false,
    },
    clientSecret: {
      type: 'string',
      mask: true,
    },
    ingestGroups: {
      type: boolean,
      mask: true,
    },
  },

  validateInvocation(context: IntegrationExecutionContext) {
    const { config } = context.instance;

    if (!config.clientId || !config.clientSecret) {
      throw new IntegrationInstanceConfigError(
        'Config requires a clientId and clientSecret to be provided',
      );
    }

    await validate(config);
  },

  getStepStartStates(
    executionContext: IntegrationExecutionContext,
  ): StepStartStates {
    const { config } = executionContext.instance;

    const notDisabled = { disabled: false };
    const shouldIngestGroups = config.ingestGroups;

    return {
      'fetch-accounts': notDisabled,
      'fetch-users': notDisabled,
      'fetch-groups': { disabled: !config.ingestGroups },
    };
  },

  integrationSteps: [
    {
      id: 'step-fetch-accounts',
      name: 'Fetch Accounts',
      types: ['my_integration_account'],
      async executionHandler(
        executionContext: IntegrationStepExecutionContext,
      ) {
        return fetchAccounts(executionContext);
      },
    },
    {
      id: 'step-fetch-users',
      name: 'Fetch Users',
      types: ['my_integration_user'],
      async executionHandler(
        executionContext: IntegrationStepExecutionContext,
      ) {
        return fetchUsers(executionContext);
      },
    },
    {
      id: 'step-fetch-groups',
      name: 'Fetch Groups',
      types: ['my_integration_group'],
      executionHandler(executionContext: IntegrationStepExecutionContext) {
        return fetchGroups(executionContext);
      },
    },
    {
      id: 'step-build-user-to-group-relationships',
      name: 'Build relationships',
      types: ['my_integration_user_to_group_relationship'],
      dependsOn: ['step-fetch-users', 'step-fetch-groups'],
      async executionHandler(
        executionContext: IntegrationStepExecutionContext,
      ) {
        return fetchAccounts(executionContext);
      },
    },
  ],
};
```

This includes required configuration fields needed to run the integration, a
function for performing config field validation, a function for determining
which steps of an integration to ignore, and a list of steps that define how an
integration should collect data.

The SDK execution process will construct this object based on an opinionated
directory layout. Use the provided
[Integration Template](/template/README.md#project-structure) to get started.

### `IntegrationInvocationConfig` fields

#### `instanceConfigFields`

The `instanceConfigFields` field contains a map of integration fields that are
required to be provided for authenticating with a given provider API. This
varies between services.

#### `validateInvocation`

The `validateInvocation` field is a validation function that is required for
ensuring the integration has received a valid set of `instanceConfigFields`. It
is common practice to execute a test API call to ensure everything has been
configured properly.

It is assumed that the integration's configuration is valid if the validation
function executes without error. If an error is thrown, a message will be
published to the integration's event log stating that validation has failed.

It is recommended that integration developers throw an
`IntegrationValidationError` with details about why validation has failed in the
error's message. This allows for the error's message to be included in the logs.

Example:

```typescript
import { IntegrationValidationError } from '@jupiterone/integration-sdk';

function validateInvocation(context: IntegrationExecutionContext) {
  const { config } = context.instance;

  if (!config.clientId || !config.clientSecret) {
    throw new IntegrationValidationError(
      'Config requires a clientId and clientSecret to be provided',
    );
  }

  await validate(config);
}
```

Using the above example, the following message will be logged if the config's
`clientId` or `clientSecret` is not set:

`Error occurred while validating integration configuration. (errorCode=CONFIG_VALIDATION_ERROR, errorId=<generated error id>, reason=Config requires a clientId and clientSecret to be provided)`;

#### `getStepStartStates`

The `getStepStartStates` is an optional function that can be provided for
determining if a certain step should be run or not.

#### `integrationSteps`

The `integrationSteps` field is used to define how an integration collects data.
It is expected that an array of "steps" to perform the collection of data needs
to be passed in.

A `step` must contain an `id`, `name`, list of `types` that the step expects to
generate and an `executionHandler` function that performs the data collection
work. It is important to provide `types` because that data will be used to
provide context for the backend synchronization process and determine how
updates and deletes should be applied.

Optionally, a `step` can contain a `dependsOn` list that references to steps
that need to execute before the current step can run. This field will be used to
determine if previous work has failed to complete and if the synchronization
process should treat the data retrieved in the step as a partial dataset. See
the [Failure handling](#Failure handling) section below for more information on
partial datasets.

### How integrations are executed

The `IntegrationInvocationConfig` declaratively defines how an integration runs.
The CLI that is provided by this package will consume the invocation
configuration and construct a state machine to execute work in a specific order.

#### Validation

The `validateInvocation` function will run first to ensure the integration is
capable of interfacing with a given provider. Next, the `getStepStartStates`
will run to get a list of integration steps that should be executed.

#### Collection

Finally, the steps defined in `integrationSteps` are executed based on the
dependency list provided by each step's `dependsOn` field.

The integration sdk will construct a dependency graph to determine the order in
which steps will be executed (likely be using a third party library like
[dependency-graph](https://github.com/jriecken/dependency-graph#readme)).

After the dependency graph was constructed, the integration sdk will in begin
execution of all leaf steps first. As a step completes, the integration sdk will
check for dependent steps that are now eligible to run and invoke them. This
process will repeat until there are no more steps to run.

### What's in the `IntegrationExecutionContext` and `IntegrationExecutionStepContext`?

#### `IntegrationExecutionContext`

The `IntegrationExecutionContext` contains some basic utilities to provide some
information about the entity data.

##### `instance`

An `instance` field containing the integration instance, which contains
configuration field values stored under a `config` field. When only performing
local data collection, this is mocked out.

##### `logger`

It includes a `logger` that can be used by the integration developer for
debugging their integration. This follows a similar api to other Node.js loggers
such as [bunyan](https://github.com/trentm/node-bunyan) or
[pino](https://github.com/pinojs/pino), providing a standard set of log levels
(`debug`, `trace`, `info`, `warn`, and `error`) and also allowing for child
loggers to be created via the `child` function.

Most information logged via the `logger` will _not_ be displayed to customers
via the integration job event log, but there are some special messages that need
to be displayed to customers to allow them to know if there are issues
preventing integrations from collecting data.

For these cases, we will provide specialized functions on the `logger` to assist
with displaying those kinds of messages.

A `logger.auth` function for displaying authorization related warnings or errors
encountered while data is being collected in the steps.

Additionally, errors logged via `logger.error` will be displayed by customers as
well. This is helpful for providing customers with some context about provider
api issues that prevent data from being collected.

###### `forbiddenResource`

The `forbiddenResource` function will be exposed to allow developers to display
warnings that the integration's access to a given resource is not allowed. This
message helps integration consumers understand that the configuration they have
provided has insufficient permissions and if they want to resolve this, changes
need to be made.

#### `IntegrationExecutionStepContext`

The `IntegrationExecutionStepContext` contains the same data stored in the
`IntegrationExecutionContext` but also contains a `jobState` object that
provides utilities for collecting and validating graph data.

##### `jobState`

The `jobState` object is used for collecting entities and relationships that
have been created throughout the integration run via the `addEntities` and
`addRelationships` functions.

Previously collected integration data can be collected via the `iterateEntities`
and `iterateRelationships` function. These functions will initially allow for
data to be fetched via the `_type` property, but in the future will allow
provide more options for collecting.

Example usage:

```typescript
await iterateEntities({ _type: 'my_integration_user' }, async (userEntity) => {
  await doWorkWithEntity(userEntity);
});
```

More details about how the framework uses `jobState` is detailed in the [Data
collection](# Data collection) section below.

### Additional utilities

#### Data conversion

A `convertProperties` function is exposed by the sdk to reformat an object into
a flattened object that can be used for building entities.

#### Graph data generation and validation

To assist with constructing data that is compliant with JupiterOne's model, the
integration SDK exposes utility functions (`createIntegrationEntity` and
`createIntegrationRelationship`) for validating entities and relationships based
on their assigned `_class`.

These functions will automatically validate that an entity contains required
fields.

##### `createIntegrationEntity`

`createIntegrationEntity` accepts an object containing `entityData`, which
accepts a `source` object (from the provider), an `assign` object that contains
core entity properties, and an optional `tagProperties` array for mapping source
properties to tags.

Snippet of input type used by the `createIntegrationEntity` function:

```typescript
export type IntegrationEntityBuilderInput = {
  /**
   * Data used to generate an `Entity`.
   */
  entityData: IntegrationEntityData;
};

/**
 * Data used to generate an `Entity`.
 */
export type IntegrationEntityData = {
  /**
   * Data from a provider API that will be selectively transferred to an
   * `Entity`.
   *
   * The common properties defined by data model schemas, selected by the
   * `assign._class`, will be found and transferred to the generated entity.
   */
  source: ProviderSourceData; // accepts pretty much any object

  /**
   * Literal property assignments. These values will override anything
   * transferred from the `source` data.
   */
  assign: LiteralAssignments; // core entity properties like _class, _type, _key

  /**
   * The names of properties that will be assigned directly to the entity from
   * tags with matching names. See `assignTags`.
   */
  tagProperties?: string[];
};
```

The function will collect properties from the `source` object that match the
`_class` defined in our data model, apply the `assign` object values, and also
store the `source` under a `_rawData` attribute on the entity.

Schema validation will be then performed to ensure that entity fits the schema
of the `_class` it was assigned.

Some fields on the `source` object are used as default values for entity
properties.

A `providerId` or `id` property on the `source` object will be used as the
`_key` property if the `_key` is not provided on the `assign` object. Also, the
`tags` property from the `source` object will be normalized and added to the
generated entity as properties prefixed with `tag.`.

Here's an example of how the `createIntegrationEntity` function can be used to
convert Azure SQLDatabases into a JupiterOne entity.

```typescript
export function createDatabaseEntity(
  webLinker: AzureWebLinker,
  data: MySQLDatabase | SQLDatabase,
  _type: string,
) {
  return createIntegrationEntity({
    entityData: {
      source: data,
      assign: {
        ...convertProperties(data),
        _type,
        _class: AZURE_DATABASE_ENTITY_CLASS,
        displayName: data.name || data.id || 'unnamed',
        classification: null,
        encrypted: null,
      },
    },
  });
}
```

##### `createIntegrationRelationship`

`createIntegrationRelationship` can be used to help build relationships between
entities.

There are two types of relationships that can be built: Direct relationships and
Mapped relationships.

Direct relationships are explicit edges constructed between two entities from
the same integration.

Mapped relationships are edges that are built from a source entity to a target
entity that may be managed by a different integration or may not be known by any
integration. Mapped relationships also allow for more generalized relationships
to be created from a source entity to multiple target entities based on a set of
filters.

A common use case for mapped relationships is for building edges between a
security group that allows access to the public internet (a global entity not
managed by an integration). This can help determine which servers or workloads
have access to the open internet and can be used to assist with locking down
security groups for services that do not require internet access.

Another use case is for mapping `User` entities created by an integration to
their `Person` entity based off of their name or email. That relationship can
then be used to help determine what services a person in an organization may
have access to.

The function accepts multiple different options:

- `DirectRelationshipOptions`
- `DirectRelationshipLiteralOptions`
- `MappedRelationshipOptions`
- `MappedRelationshipLiteralOptions`

If needed, additional properties can be added to relationships created via the
`properties` field that exists on all options.

###### `DirectRelationshipOptions`

If you have access to the two entities, you can simply provide them as inputs to
the function via the `from` and `to` options.

```typescript
// input type
type DirectRelationshipOptions = {
  _class: string;
  from: Entity;
  to: Entity;
  properties?: AdditionalRelationshipProperties;
};

// usage
createIntegrationRelationship({
  _class: 'has',
  source: entityA,
  target: entityB,
});
```

###### `DirectRelationshipLiteralOptions`

If you know the `_type` and `_key` of the two entities you want to relate, you
can provide them via the `fromType`, `fromKey`, `toType`, and `toKey`
properties.

```typescript
// input type
type DirectRelationshipLiteralOptions = {
  _class: string;
  fromType: string;
  fromKey: string;
  toType: string;
  toKey: string;
  properties?: AdditionalRelationshipProperties;
};

// usage
createIntegrationRelationship({
  _class: 'HAS',
  fromKey: 'a',
  fromType: 'a_entity',
  toKey: 'b',
  toType: 'b_entity',
});
```

###### `MappedRelationshipOptions`

Mapped relationships accept a `source` and `target` entity for constructing
relationships.

The `Internet` and `Everyone` global entities are exposed by the
`@jupiterone/data-model` and can be used here.

The relationship direction can be specified using the `relationshipDirection`
option.

`skipTargetCreation` can be set to `false` to have JupiterOne skip the creation
of the target entity if it does not exist.

Additional options are defined below.

```typescript
// input type
type MappedRelationshipOptions = {
  _class: string;
  source: Entity;
  target: TargetEntity;
  properties?: AdditionalRelationshipProperties;

  /**
   * Defaults to `RelationshipDirection.FORWARD`, assuming the common case of
   * source -> target.
   */
  relationshipDirection?: RelationshipDirection;

  /**
   * Identifies properties in the `targetEntity` that are used to locate the
   * entities to connect to the `sourceEntityKey`.
   *
   * Defaults to `[["_type", "_key"]]`, allowing for the simple case of mapping
   * to a known type and key.
   */
  targetFilterKeys?: TargetFilterKey[];

  /**
   * Defaults to `undefined`, leaving it up to the default established in the
   * mapper.
   */
  skipTargetCreation?: boolean;
};

// usage
createIntegrationRelationship({
  _class: 'allows',
  source: securityGroupEntity,
  target: DataModel.Internet,
  relationshipDirection: RelationshipDirection.FORWARD
}),
```

###### `MappedRelationshipLiteralOptions`

For additional control, mapped relationships can be created by providing fine
details on how mappings should be generated. This is useful for cases where more
generalized relationships need to be created between a source entity and one or
more target entities that match a set of properties.

````typescript
// input type
type MappedRelationshipLiteralOptions = {
  _class: string;
  _mapping: RelationshipMapping;
  properties?: AdditionalRelationshipProperties;
};

export interface RelationshipMapping {
  /**
   * The relationship direction, `source - FORWARD -> target` or
   * `source <- REVERSE - target`.
   */
  relationshipDirection: RelationshipDirection;

  /**
   * The `_key` value of the entity managed by the integration, to which
   * relationships will be created.
   *
   * "Source" implies that the graph vertex will have an outgoing edge. However,
   * that is not necessarily the case. See `relationshipDirection`.
   */
  sourceEntityKey: string;

  /**
   * Identifies properties in the `targetEntity` that are used to locate the
   * entities to connect to the `sourceEntityKey`. For example, if you know that
   * you want to build a relationship to user entities with a known email, this
   * can be expressed by:
   *
   * ```js
   * {
   *   targetFilterKeys: [['_class', 'email']],
   *   targetEntity: {
   *     _class: 'User',
   *     email: 'person@example.com',
   *     firstName: 'Person',
   *     lastName: 'Example'
   *   }
   * }
   */
  targetFilterKeys: TargetFilterKey[];

  /**
   * Properties of the target entity known to the integration building the
   * relationship.
   *
   * The property values of the `targetFilterKeys` are used to find the target
   * entities. When the mapper manages the target entity (it created the entity,
   * no other integration owns it), it will update the entity to store these
   * properties. This allows a number of integrations to contribute data to
   * "fill out" knowledge of the entity.
   */
  targetEntity: TargetEntityProperties;

  /**
   * By default, an entity will be created by the mapper when no matching
   * entities are found.
   *
   * When a relationship is not meaningful unless target entities already exist,
   * `skipTargetCreation: true` will inform the mapper that the entity should
   * not be created.
   */
  skipTargetCreation?: boolean;
}

// usage:
//
// This will create a relationship(s) from the
// source entity with _key = 'a'
// and target entities that match the class 'User'
// and have the email set to 'email@example.com'
createIntegrationRelationship({
  _class: 'HAS',
  _mapping: {
    relationshipDirection: RelationshipDirection.REVERSE,
    sourceEntityKey: 'a',
    targetEntity: {
      _class: 'User',
      email: 'email@example.com',
    },
    targetFilterKeys: [['_class', 'email']],
  },
});
````

#### Raw data collection

In addition to performing validation, the `createIntegrationEntity` and
`createIntegrationRelationship` will also automatically encode and store the
original provider data under a `_rawData` field. For now, this will always
assume that data coming in was stored as `json`, but support for other data
types will come later.

#### Testing

Please see [testing.md](./testing.md) for more information about testing
utilities exposed by this project.

### Auto-magic behind the framework

#### Event reporting

When running an integration, information logged via the `logger` will
automatically be published `stdout`. For convenience, the integration framework
will automatically log out transitions between steps. This allows for developers
to keep track of how the integration is progressing without the need to
explicitly add logging information themselves.

When the integration is run with context about an integration instance (via the
`run` command exposed by the [The CLI](# The CLI)), the transitions between each
`step` will be published to the JupiterOne integration events log. `auth` and
`error` logs will also be published there.

#### Data collection

The `executionContext` that is provided in the `executionHandler` step exposes a
`jobState` utility that can be used to collect entity and relationship data via
`addEntities` and `addRelationships` functions. The `jobState` utility will
automatically flush the data to disk as a certain threshold of entities and
relationships is met. The data flushed to disk are grouped in folders that based
on the step that was run. Entities and relationships will also be grouped by the
`_type` and linked into separate directories to provide faster look ups. These
directories will be used by the `iterateEntities` and `iterateRelationships`
functions to provide faster lookups.

From our experience, integrations most commonly query collected data from
previous steps the `_type` property for constructing relationships, so the
integration framework currently optimizes for this case. In the future, we plan
to allow data to be indexed in different ways to assist with optimizing
different approaches constructing entities and relationships. It is worth noting
that the method in which data is indexed can change in the future.

Using the integration configuration that was provided as a sample earlier, data
will be written to disk in the following structure (relative to the
integration's current working directory).

To assist with debugging and visibilty into exactly what data was collected, the
integration will bucket data collected from each step. Here is an example of
what the `.j1-integration` directory may look like.

```
.j1-integration/
  /index/
    /entities/
      _type
        my_integration_account/
          11fa25fb-dfbf-43b8-a6e1-017ad369fe98.json
        my_integration_group/
          f983f07d-f7d8-4f8e-87da-743940a5f48d.json
          a76695f8-7d84-411e-a4e1-c012de041034.json
        my_integration_user/
          9cb7bee4-c037-4041-83b7-d532488f26a3.json
          96992893-898d-4cda-8129-4695b0323642.json
    /relationships
      _type/
        my_integration_user_to_group_relationship/
          8fcc6865-817d-4952-ac53-8248b357b5d8.json
  /graph
    /step-fetch-accounts
      /entities/
        11fa25fb-dfbf-43b8-a6e1-017ad369fe98.json
      /relationships
    /step-fetch-users
      /entities
        9cb7bee4-c037-4041-83b7-d532488f26a3.json
        96992893-898d-4cda-8129-4695b0323642.json
      /relationships
    /step-fetch-groups
      /entities
        a76695f8-7d84-411e-a4e1-c012de041034.json
        f983f07d-f7d8-4f8e-87da-743940a5f48d.json
      /relationships
    /step-build-relationships
        /relationships
          8fcc6865-817d-4952-ac53-8248b357b5d8.json
```

Integration data that is staged for publishing will be stored under the
`.j1-integration/graph` directory. Files containing Entities will be suffixed
with `.entities.json` and files containing Relationships will be suffixed with
`.relationships.json`. This is done because the directory structure of the
`graph` directory is meant to assist with debugging and provide developrs
insight about the data collect in each step. During synchronization, the
directory will be blind

Data will be indexed by `_type` and stored under the
`.j1-integration/index/_type` directory.

Each `json` file will store data under the following format (describe with a
typescript interface):

```
interface FlushedEntityGraphData {
  entities: Entity[]
}

interface FlushedRelationshipGraphData {
  relationships: Relationship[]
}
```

It's best to keep a "collect and forget" mindset to avoid retaining too much
collected data in memory. Flushed data can always be pulled back into memory
later via the `listEntitiesByType` and `listRelationshipsByType` and reading
data from disk is decently fast.

#### Failure handling

By default, the framework will only halt the execution of an integration if the
configuration validation fails. Failures that occur during the execution of a
step will not halt the execution of later steps that depend on it. Information
on which steps that have failed will be collected and published as metadata when
performing synchronization with JupiterOne. A failure in a step will
automatically be logged along with context about the error that occurred. At the
end of an integration run, a summary will be displayed of the overall status to
give developers a good idea of how failures will have affected the JupiterOne
graph.

An example summary of the steps will like this:

```json
[
  {
    "id": "step-fetch-accounts",
    "name": "Fetch Accounts",
    "declaredTypes": ["my_integration_account"],
    "encounteredTypes": ["my_integration_account"],
    "status": "success"
  },
  {
    "id": "step-fetch-users",
    "name": "Fetch Users",
    "declaredTypes": ["my_integration_user"],
    "encounteredTypes": [],
    "status": "failure"
  },
  {
    "id": "step-fetch-groups",
    "name": "Fetch Groups",
    "declaredTypes": ["my_integration_group"],
    "encounteredTypes": ["my_integration_group"],
    "status": "success"
  },
  {
    "id": "step-build-user-to-group-relationships",
    "name": "Fetch Accounts",
    "declaredTypes": ["my_integration_user_to_group_relationship"],
    "encounteredTypes": ["my_integration_user_to_group_relationship"],
    "dependsOn": ["step-fetch-users", "step-fetch-groups"],
    "status": "partial_success_from_dependency_failure"
  }
]
```

Options for pretty printing this data in a more concise format may come in the
future.

##### Step status codes

For steps: `success` - the step has successfully completed without any errors
occurring `failure` - an error has occurred and it is possible that we have a
partial dataset `partial_success_from_dependency_failure` - the step has
successfully completed but a dependent step was found in the `failure` or
`partial_success_from_dependency_failure`, meaning it is possible that a failure
has happened.

#### Letting the synchronizer know about partial datasets

The framework's state machine will utilize `declaredTypes` and `dependsOn`
fields from the step results for constructing a list of entity and relationship
types that should be considered a partial dataset. The backend synchronization
process that performs he diffing of the data will receive a list of types that
have been affected by a failure to help determine how updates should be applied
and what data is safe to delete. The information about partial datasets will be
sent when starting the synchronization process to prevent data that should be
retained in the graph from being removed.

After the collection phase, the integration summary and partial datasets
metadata will be written to disk in the `.j1-integration/summary.json` file.

Here is an example of what the summary file would look like.

```json
{
  "integrationStepResults": [
    {
      "id": "step-fetch-accounts",
      "name": "Fetch Accounts",
      "declaredTypes": ["my_integration_account"],
      "encounteredTypes": ["my_integration_account"],
      "status": "success"
    },
    {
      "id": "step-fetch-users",
      "name": "Fetch Users",
      "declaredTypes": ["my_integration_user"],
      "encounteredTypes": [],
      "status": "failure"
    },
    {
      "id": "step-fetch-groups",
      "name": "Fetch Groups",
      "declaredTypes": ["my_integration_group"],
      "encounteredTypes": ["my_integration_group"],
      "status": "success"
    },
    {
      "id": "step-build-user-to-group-relationships",
      "name": "Fetch Accounts",
      "declaredTypes": ["my_integration_user_to_group_relationship"],
      "encounteredTypes": ["my_integration_user_to_group_relationship"],
      "dependsOn": ["step-fetch-users", "step-fetch-groups"],
      "status": "partial_success_from_dependency_failure"
    }
  ],
  "metadata": {
    "partialDatasets": {
      "types": [
        "my_integration_user",
        "my_integration_user_to_group_relationship"
      ]
    }
  }
}
```

The `integrationStepResults` is made available for developers to understand the
status of each step after collection has been completed.

The `metadata` contains a `partialDatasets` field that is a reduced collection
of `types` from steps that have returned with a `failure` or
`partial_success_from_dependency_failure` status.

The `metadata` field will be sent to JupiterOne upon performing the
`synchronization`.

##### Detecting undeclared types

In the examples from the previous sections, you may have noticed that
`integrationStepResults` contains `declaredTypes` and `encounteredTypes`. The
`declaredTypes` are the `types` provided to the `IntegrationStep` object. As an
integration collects data, the `_type` values from both entities and
relationships are added to the `encounteredTypes` field. These fields are diffed
and a warning will be displayed if there are undeclared types detected.

It is important that each integration step declares all possible `_type` values
that it expects to encounter so that data is not unintentionally deleted when an
unexpected failure occurs.

## The CLI

To assist developers working with the integration framework, a `j1-integration`
CLI tool will also be exposed by this project.

### Authentication

For commands that require interaction with JupiterOne's API, the CLI will
provide ways or inputing credentials. To support that, all commands that
interact with an API will accept an `--api-key` option.

For convenience when developing locally, we will also look for a
`JUPITERONE_API_KEY` environment variable for an API key to use.

### Supported commands

Initially, the CLI will support a limited interface consisting of only three
commands: `collect`, `sync`, and `run`.

#### `j1-integration collect`

`j1-integration collect` will run the js framework locally to _only_ perform
data collection. The `collect` command is designed to work closely with the
JupiterOne integration framework.

The `collect` command will look for an integration configuration from files in
the following order relative to the current working directory:

0. `index.js`
1. `index.ts`
2. `src/index.js`
3. `src/index.ts`

Data will be written to disk under a generated `.j1-integration` directory
(described in [this section](### Data collection). A JupiterOne API key or set
of credentials do not have to be supplied since the JupiterOne synchronization
API will not be hit. An exception to this is when the `--instance` option is
provided. (see `Options` below).

To assist with making the integrations easier to develop, a mock integration
instance will be provided with fake values.

An integration cannot run without actual data from a provider though, so CLI
will use the [dotenv](https://github.com/motdotla/dotenv) package to
automatically load and populate config values for what was supplied in the
`instanceConfigFields`.

An example `.env` file for the example integration configuration defined [in one
of the earlier sections](#The integration framework) would look like this:

```bash
CLIENT_ID="<insert provider client id here>"
CLIENT_SECRET="<insert provider client secret here>"
INGEST_GROUPS="<true or false>"
```

The snake cased environment variables will automatically be converted and
applied to the camel cased configuration field. So for example, `CLIENT_ID` will
apply to the `clientId` config field, `CLIENT_SECRET` will apply to
`clientSecret`, and `MY_SUPER_SECRET_CONFIGURATION_VALUE` will apply to a
`mySuperSecretConfigurationValue` configuration field.

This command will display the expected environment variables that should be set
prior to performing validation to provide developers feedback about what the
integration expects to see set.

##### Options

###### `--module` or `-m`

If you prefer to not to place your integration configuration in one of the
supported file paths, you can optionally specify the `--module` or `-m` option
and provide a path to your integration file.

ex: `j1-integration collect --module path/to/my/integration.ts`

###### `--instance` or `-i`

If you are working with an existing integration instance and would prefer to
leverage the configuration field values from that be used, you can optionally
supply an instance id. The CLI will leverage the values stored on the
integration instance instead of locally defined environment variables.

By default, when an `--instance` is specified, a developer will be prompted to
input some credentials or provide an `--api-key` option.

ex: `j1-integration collect --instance <integration instance id>`

###### `--api-key` or `-k`

For developers that have an API key or prefer to not input credentials, an
`--api-key` option can be specified to access the synchronization API.

ex:
`j1-integration collect --instance <integration instance id> --api-key <my api key>`

###### `--step` or `-s`

For larger integrations, a full collection run may take a long time. To help
address this, a `--step` option can be provided to selectively run a step along
with all of it's dependent steps.

Multiple `--step` options can be provided to allow for more than one step to be
run.

ex: `j1-integration collect --step step-fetch-users --step step-fetch-groups`

For convenience, steps can allow be provided as a comma delimited list.

ex: `j1-integration collect --step step-fetch-users,step-fetch-groups`

###### `--ignore-step-dependencies`

If you only want to run a single step or an explicit list of steps without
invoking the dependencies of those steps, you can do so via the
`--ignore-step-dependencies` flag. This is useful for speeding up testing by
utilizing the data that has already been collected and stored on disk.

#### `j1-integration sync`

The `sync` command will validate data placed in the `.j1-integration/graph`
directory has been formatted correctly and later format the data to allow for
data to be uploaded to JupiterOne for synchronization. Since the `sync` command
does interact with the JupiterOne synchronization API, the developer will need
to provide either credentials or an API key.

After validation is performed, `sync` will provision an integration job via a
`POST` to
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs` which
will be used for scoping integration data that is uploaded for synchronization.

Entity data will be published to
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs/:jobId/entities`.

Relationship data will be published to
`https://api.us.jupiterone.io//synchronization/:integrationInstanceId/jobs/:jobId/relationships`.

After all of the data under the `.j1-integration/graph` directory has been
published, the CLI will `POST` to
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs/:jobId/finalize`
with `metadata` that was stored in `.j1-integration/summary.json`.

This will signal JupiterOne that it is time to synchronize the published data
with the graph.

After this point, by default the CLI will end and log out a URL that can be used
to track the job status.
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/job/:jobId`

Optionally, developers can specify the `--tail` flag to automatically poll the
integration job for status updates. The polling will end once the job has been
marked as completed and metadata about the synchronization status will be
returned.

##### Keeping the door open for developers not using JavaScript or TypeScript

Not everyone uses the Node.js ecosystem and we understand that. For developers
that would prefer to use a different language for building integrations, the
`sync` command does not require that a developer use the JupiterOne integration
framework at all. The `sync` command will just recursively walk the
`.j1-integration/graph` directory, search for `.json` files, validate the data
to ensure it is formatted correctly, and publish it up via the synchronization
API.

The JupiterOne data model is open source and can be used by anyone to ensure
that data conforms to our expectations. If you build custom tooling or your own
framework for developing integrations, let us know!

##### Options

###### `--module` or `-m`

Much like the `collect` command, you can optionally specify an `--module` or
`-m` option to specify the path to the integration configuration file.

###### `--instance` or `-i`

For the `sync` command, an integration instance must be specified to know which
integration instance data the collected data should be associated with.

ex:
`j1-integration sync --instance <integration instance id> --api-key <my api key>`

###### `--api-key` or `-k`

Like the `collect` command, an API key can be optionally passed in to use for
synchronization.

ex:
`j1-integration sync --instance <integration instance id> --api-key <my api key>`

###### `--tail` or `-t`

If provided this option poll the integration job to and display the status of
the job run. The polling will stop once the job was marked as complete.

ex: `j1-integration sync --instance <integration instance id> --tail`

#### `j1-integration run`

The `j1-integration run` command combines the functionality of the `collect` and
`sync` commands, essentially running the commands back to back.

The `run` command accepts the same options that the `sync` command accepts.

There are some differences when performing `run` compared to individually
running `collect` and `sync`.

Instead of using a mock integration instance for during the `collect` phase,
`run` will always pull down an actual integration instance prior to data
collection.

After initial integration validation, `run` will provision an integration job
and work performed by steps will automatically be published to our event log via
the
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs/:jobId/events`
API.

##### `j1-integration visualize`

The `j1-integration visualize` command reads JSON files from the
`.j1-integrations/graph` directory and generates a visualization of the data
found using [vis-network](https://visjs.github.io/vis-network/docs/network/).

The `visualize` command accepts an optional parameter `--data-dir` allowing the
user to specify a custom directory to read JSON files from. By default the
`visualize` command will read from the `.j1-integrations/graph` directory
generated by the `collect` command.

When supplying the `--data-dir` ensure the following format within your JSON
files:

```json
// Entities
{
  "entities": [
    {
      "_key": "...",
      "displayName": "..."
    }
    // ...
  ]
}
```

```json
// Relationships
{
  "relationships": [
    {
      "_fromEntityKey": "...",
      "_toEntityKey": "...",
      "displayName": "..."
    }
    // ...
  ]
}
```

#### Future commands and utilities

##### More commands and options

###### `j1-integration plan`

We hope to make it easy for developers to understand how an integration collects
data and the order in which it performs work.

We hope to support a `j1-integration plan` command to display the dependency
graph of the steps and types required for a successful integration run.

###### `j1-integration sync --dry-run`

A developer may want to have a better understanding of how synchronization of
collected data may affect their JupiterOne graph. We plan to support a
`--dry-run` flag for both the `sync` and `run` commands to provide some feedback
about what kind of changes will be applied to the graph.

This dry run function will give metrics about how many creates, updates, and
deletes will be performed, categoried by the entity and relationhip `_type`
field.

###### `j1-integration generate`

A project generator might be helpful for getting new integration developers up
and running quickly. For our own integration developers, it would provide a
consistent interface and allow developers a unified interface for building
integrations. This may even go an `ember` or `angular` cli route and provide an
opinionated interface for generating new steps.

##### One CLI tool for all JupiterOne development

The `j1-integration` CLI is a standalone tool designed to work just for
integration development. The CLI tool will be designed in a way that allows for
it to be added as an `integration` subcommand for the `j1` CLI (so you can run
things like `j1 integration sync` but also maybe something like `j1 query` from
a single tool). This will likely be done by forwarding commands from the core
`j1` cli to the `j1-integration` executable or by exposing the code used for
constructing the `j1-integration` CLI to the project that handles the `j1` cli.

In the future, the `j1` CLI will provide a suite of commands for interfacing
with queries, questions, rules, and various other JupiterOne features. This may
end up living under a `@jupiterone/dev-tools` project. That repo might even end
up becoming a monorepo and become a one stop shop for all JupiterOne related
development tools.

##### Better methods of authentication with JupiterOne

The current implementation of the `j1` cli requires that an API key or set of
credentials be supplied to interface with APIs. We plan to introduce a `j1 auth`
command which will accept credentials and store the refresh and access tokens
somewhere on your file system for later use with all CLI commands. For users
that would prefer to not use an API key, this would provide a more friendly
interface for running commands that require API access. We plan to support SSO
integration with this as well.

## Does JupiterOne use this SDK for managed integrations?

We plan utilize this framework and the `j1-integration run` command for all new
integrations made. For our older integrations, we plan to eventually be migrate
them over to using this SDK.

Also since we have internal access to our APIs, we have some bypasses in place
that allow for us to directly access those apis without going through our usual
gateway.

## Future work around integrations

### `external` integrations

Sometimes customers have their own data that they want to publish and don't
necessarily want JupiterOne to manage the execution of it.

We've seen customers use our Entity/Relationship mutation APIs to build their
own integrations. Part of our reason for building and open sourcing an
integration SDK is to help out those users that perform their own diffing and
graph state management.

We hope to support the concept of an `external` integration in the near future
that will work just like our regular integrations and work with our SDK. The
only difference is that you can define your own integration (the name,
description, and configuration fields) and we won't run automatically run the
integration for you on a regularly scheduled interval (although, the option to
do have us do that is certainly something we are considering!).

### Event ingestion

At the moment a few of our managed JupiterOne integrations are capable of
handling events that perform a partial ingestion of data from a provider and
immediately reflect that in the graph.

We hope to provide a good interface via this SDK for providing an interface for
handling events via this SDK and providing commands/utilities for testing events
to get an understanding of how they may affect the JupiterOne graph.
