# @jupiterone/integration-sdk-core

_NOTE:_ This project is currently under development and the API interface is not
stable. Use at your own risk.

This package contains core utilties and types that integration developers will
interface with.

## Installation

```
npm install @jupiterone/integration-sdk-core

# or

yarn add @jupiterone/integration-sdk-core
```

## Integration Development

Please reference the [development documentation](docs/development.md) for
details about how to develop integrations with this SDK.

An example template project can be found
[here](https://github.com/JupiterOne/integration-sdk/tree/master/template).

## Integration SDK Development

If you are making changes to the integration SDK and you want to test the
changes in another integration project then it is recommended to automatically
rebuild and link this project when changes are made.

Steps to automatically build and link:

- Run `yarn autobuild` in _this_ project from a terminal and wait for initial
  build to complete.

- In a separate terminal, run `yarn link @jupiterone/integration-sdk` in the
  integration project. You can now use the integration SDK CLI in the other
  project and it will use the latest code on your filesystem.
