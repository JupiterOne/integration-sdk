# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 3.0.1 - 2020-05-26

`3.0.0` is a major release because a number of types have changed to clarify the
capability of the data collecting step dependency graph to function apart from a
JupiterOne integration definition/instance. Typical integrations should be able
to adopt this version with no changes necessary.

### Added

- `JUPITERONE_DISABLE_EVENT_LOGGING` environment variable may be set to `"true"`
  to disable sending job events to JupiterOne. This is useful when executing an
  integration apart from the JupiterOne job execution lifecycle, where there is
  no desire to have the activity of execution delivered to any job event log.

- `synchronizationApiError()` generates an error based on an error response from
  the JupiterOne synchronization API. This has been exported to allow for unique
  synchronization processing situations, where interactions with the
  synchronization API are not performed through `j1-integration sync`.

- `createLogger()` configures a logger for executing data collection steps. This
  has been exported alongside the existing `createIntegrationLogger()` to allow
  for data collection outside the context of a JupiterOne integration. That is,
  when there is no `IntegrationInstance` involved in data collection,
  `createLogger()` is sufficient for executing the step dependency graph.

## 2.1.4 - 2020-05-23

### Added

- `setRawData`, `getRawData` support safer access to an entity's `_rawData`
  collection. `createIntegrationEntity` will assign the `"default"` raw data
  from the `source` argument, but there are some cases where additional raw data
  needs to be added. The name needs to be unique within the entity, so `setData`
  will ensure this to be the case. `rawData` is typically used during
  `jobState.iterateEntities` loops, to get access to data that isn't added to
  the entity properties but is useful in building relationships.

### Changed

- Upgrade to `@jupiterone/data-model@0.6.0`

- `assignTags` was `trim()`ing twice, once is sufficient.

## 2.1.3 - 2020-05-20

### Added

- Detect and warn when undeclared `_type` values are found. Encountered types
  are now displayed on the `IntegrationStepResult` object.

- `assignTags` now supports a `string` or `string[]` value that will be assigned
  to a new `tags` property on the entity. Previously, the function would take
  only key/value pairs and assign each pair to the entity as
  `"tag.<key>": <value>`.

### Changed

- A step's `types` are now stored as `declaredTypes` on the
  `IntegrationStepResult` object.

## 2.1.2 - 2020-05-20

### Changed

- Upgrade to `@jupiterone/data-model@0.5.2`

## 2.1.1 - 2020-05-20

### Changed

- Upgrade to `@jupiterone/data-model@0.5.0`

## 2.1.0 - 2020-05-20

### Added

- Export `SetupRecordingInput` from `@jupiterone/integration-sdk/testing` to
  allow integrations to provide something like
  `setupAzureRecording(input: SetupRecordingInput)`, which may then add common
  options and call `setupRecording`.

- Export `RecordingEntry` from `@jupiterone/integration-sdk/testing` to allow
  typing in `mutateEntry(entry: RecordingEntry)`.

### Fixed

- `createIntegrationEntity` would transfer properties of type `object` and
  `object[]`, which are never valid on an entity.

- Constructors of `IntegrationProviderAuthenticationError`,
  `IntegrationProviderAuthorizationError` and `IntegrationProviderAPIError`
  required `code`, `message`, and `fatal`, which were not meant to be provided
  at all but set by the error classes themselves.

## 2.0.0 - 2020-05-18

### Added

- `JobState.setData(key, data)` and `JobState.getData(key)` allow steps to
  communicate arbitrary data to dependent steps.

- `Entity` now includes a property `id?: string` to represent the
  [`id` property supported by the data model](https://github.com/JupiterOne/data-model/blob/f07f085b39041e639f5dacd9b6140c6c3db0b5ad/src/schemas/Entity.json#L10).
  This allows for easy reference to `Entity.id` in later steps that iterate
  already-loaded entities and don't want to assume that the `_key` _is_ the
  provider's identifier (often the `_key` needs additional data to make it
  unique). Note that we plan to soon provide TS types for all the data model
  types.

### Changed

- BREAKING! Historically, the `IntegrationInstance.config` was typed as `any`.
  This provided no type safety. Now, integrations must declare an interface
  represeting the structure of their `IntegrationInstance.config` and provide
  this as a type parameter in code where there is a need to access the `config`
  properties. The type parameter is not required (defaults to type `object`),
  but there will be no access to properties (without an evil type cast to
  `any`).

  The following types now support a generic parameter for the `instance.config`
  they or their properties reference:

  - `IntegrationInstance`,
  - `IntegrationInvocationConfig`,
  - `IntegrationExecutionContext`,
  - `IntegrationStepExecutionContext`
  - `IntegrationStep`
  - `GetStepStartStatesFunction`
  - `StepExecutionHandlerFunction`
  - `InvocationValidationFunction`
  - `createMockExecutionContext`

## 1.1.4 - 2020-05-18

### Fixed

- `addRelationship` added to entities collection instead of relationships.

## 1.1.3 - 2020-05-16

### Changed

- Upgraded to `@jupiterone/data-model@0.4.1`

## 1.1.2 - 2020-05-15

### Fixed

- `createIntegrationRelationship` did not allow for providing the relationship
  mapping `_key` property. This is necessary in the synchronizer to allow it to
  track the mapping rule.

## 1.1.1 - 2020-05-14

### Added

- Documentation on `IntegrationError` to clarify that it is not meant to be used
  directly outside the SDK.
- New errors that integrations should throw to communicate provider API errors
  during `validateInvocation` or any step. These will terminate the step, but
  provide more details to users to help them resolve some kinds of provider API
  errors.
- `JobState.addEntity` and `JobState.addRelationship` allow collecting one
  entity/relationship at a time. This supports tight looping and encourages
  quick processing of provider data to minimize memory requirements by
  offloading converted data as soon as possible. This does not mean that
  `addEntities/Relationships` should be avoided of course.
- Documentation of `JobState` to help those of us with short memories and
  on-hover documentation rendering in VSCode and other such modern editors. 🤠
  This also allows for communicating to new developers who just jump into the
  code.

### Changed

- Removed an unused error `IntegrationConfigValidationError`.
- Renamed `IntegrationLocalConfigFieldTypeMismatch` to
  `IntegrationLocalConfigFieldTypeMismatchError`, to match other error names.

### Fixed

- When the job state exceeded the upload batch size, multiple uploads were
  performed, but each upload included the entire dataset so that the
  synchronizer complained about duplicate keys.

## 1.1.0 - 2020-05-13

### Added

- Added additional logging to `finalizeSynchronization` and
  `executeIntegrationInstance`.

### Changed

- `registerSynchronizationJobContext` now returns a child logger.
- `initiateSynchronization` registers the synchronization job with the `logger`
  and returns a child logger with more information.

### Fixed

- Added `bunyan` and `polly` types to `dependencies` so that TypeScript
  consumers do not receive missing `d.ts` file type errors.

## 1.0.0 - 2020-05-12

### Added

- Support loading invocation configuration from `src/index`.

### Deprecated

- Deprecated convention style loading.

### Changed

- Bumped to `1.0.0` so that dependent projects can get regular semver rules and
  cleaner updates.

## 0.18.0 2020-05-01

### Added

- Automatic event logging around steps (start, end, and failure).
- An `errorCode`, `errorId`, and `reason` is now displayed in step failure
  events and logs.
- Event logging around errors thrown in `validateInvocation` function.
- Abort synchronization job when `run` and `sync` command fails.

### Changed

- Duplicate `_key` values are now detected and integration execution will now
  stop. Duplicate `_key` tracking is also performed when using mock step
  context.

## 0.17.0 2020-05-01

### Added

- `IntegrationConfigLoadError`, to be thrown when there is a configuration load
  error. This can be used by non-local execution environments that load
  configuration from somewhere special.

### Fixed

- Template missing necessary publish build.

## 0.16.0 2020-04-30

### Added

- Added support for `yarn autobuild` command to make it easier to build and link
  `@lifeomic/integration-sdk` into other projects.
- Add `dotenv-expand` which allows expansion of `${...}` variables in `.env`
  file.
- Add **Integration SDK Development** section to `README.md`

## 0.15.0 2020-04-29

### Added

- Allow storage directory to be specified via
  `JUPITERONE_INTEGRATION_STORAGE_DIRECTORY`

## 0.14.1 2020-04-29

### Changed

- Stop assuming that project files will be in `src` directory in `loadConfig` to
  allow for easier usage against bundled integrations.

## 0.14.0 2020-04-29

### Added

- Added `run` command to cli for performing both data collection and
  synchronization.
- Expose `createApiClient` and synchronization functions

## 0.13.0 2020-04-29

### Added

- Allow `loadConfig` to accept a path to a directory containing the project
  files to load.

## 0.12.0 2020-04-29

### Added

- Added `sync` command to cli for synchronizing collected data with the
  JupiterOne graph.
- Exporting `loadConfig()`, `executeIntegrationInstance()`, and
  `createIntegrationLogger()` to allow for setup and execution with alternative,
  non-generated local configuration.

## 0.11.4 2020-04-24

### Fixed

- createIntegrationEntity failing on properties with null values that exist in
  the data-model schema

## 0.11.5 2020-04-26

### Added

- Updated `@jupiterone/data-model@0.3.1`

## 0.11.0 2020-04-24

### Added

- Added `mutateRequest` function to recording to allow mutating the
  `PollyRequest` object pre-flight.
- Auto redact `authorization` header for request entries.
- Added gitleaks to template actions.

### Fixed

## 0.10.0 2020-04-23

- updated data model to latest

## 0.9.0 2020-04-23

### Added

- A `summary.json` file containing information about steps results and partial
  datasets is now written to the `.j1-integration` directory.

## 0.8.1 2020-04-22

### Fixed

- Adopted fix from `0.7.2` that did not get included in `0.8.0` release.

## 0.8.0 2020-04-22

### Added

- Adding the `j1-integration visualize` command that uses `vis-network` to
  visualize entities and their relationships generated through the
  `j1-integration collect` command.

## 0.7.2 - 2020-04-22

- Fixed issue with step states being set to an empty object if
  `getStepStartState` function was not provided.

## 0.7.0 - 2020-04-22

### Added

- `setupRecording` takes an optional parameter `options` which allows developers
  to pass in parameters found in polly's `PollyConfig` interface.
- Added `--step / -s` to `collect` command for the CLI, takes either a single
  step or comma separated steps or multiple values. E.G. `--step fetch-account`,
  `--step fetch-account,fetch-users`, or
  `--step fetch-account --step fetch-users`.

## 0.6.1 - 2020-04-21

### Fixed

- Fixed issue with dependency graph failing to wait for step dependencies to
  complete prior to performing more work

## 0.6.0 - 2020-04-21

### Changed

- If unable to create a config from environment variables,
  `createMockExecutionContext` and `createMockStepExecutionContext` will now
  generate a mock configuration for testing.

## 0.5.0 - 2020-04-20

### Added

- `setupRecording` is now exposed by the `testing` lib to assist with storing
  requests and responses made to a provider.

### Changed

- `createMockExecutionContext` and `createMockStepExecutionContext` will now
  attempt utilize the fields specified in `src/instanceConfigField.json` to
  populate the instance `config` when testing.
- Messages about loading in individual parts of the config are no longer shown
  when running `j1-integration collect`.

## 0.4.0 - 2020-04-17

### Added

- Added `engines` entry in package.json to denote package is intended to be used
  with active Node.js LTS versions (`v10.x` and `v12.x`).
- Exposed `createMockStepExecutionContext` function from
  `@jupiterone/integration-sdk/testing` to assist with unit testing steps.

## 0.3.1 - 2020-04-17

### Changed

- Expose `testing` utils via the package.json `files` field.

## 0.3.0 - 2020-04-17

### Added

- Exposed `createMockExecutionContext` function from
  `@jupiterone/integration-sdk/testing` to assist with unit testing the
  `validateInvocation` and `getStepStartState` functions.

## 0.2.2 - 2020-04-15

### Changed

- Fix windows compatibility issues

## 0.2.1 - 2020-04-14

### Changed

- Change `publishConfig` to make package public.

## 0.2.0 - 2020-04-14

### Added

- Executing an integration will now perform removal of `.j1-integration` prior
  to collecting data.
- Environment variable config loader now utilizes `dotenv` to automatically read
  `.env` file for variables.
- Logging for step completion and failures.

### Changed

- `ts-node` is no longer an explicit dependency of the project. Detection of
  TypeScript files is now performed prior to registering `ts-node`.

## 0.1.0 - 2020-04-13

### Added

- Step dependency graph creation and execution.
- Automatic `instanceConfigField` loading based on environment variable
- `validateInvocation` hook handling.
- `getStepStartState` hook for disabling steps.
- `jobState` helper object for writing collected entities and relationships.
- `createIntegrationEntity` and `createIntegrationRelationship` utilities from
  managed sdk.
- `converters`, `tagging`, and `ip` utilities from managed sdk.
- `collect` CLI command for executing integration data collection
- `logger` utility on context objects.
- Loading of configuration based on project structure.
- Loading of TypeScript project files via `ts-node`.
