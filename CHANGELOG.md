# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Update integration template to include NPM publishing, necessary script in
  `package.json`.

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
