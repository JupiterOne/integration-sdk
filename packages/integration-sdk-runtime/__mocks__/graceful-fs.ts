// HACK: to get around an issue with graceful-fs attempting to patch
// fs twice in recording tests, replace the implementation
// with our own fs mock
export * from 'fs';
