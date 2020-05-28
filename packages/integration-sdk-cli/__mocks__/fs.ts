// some dependencies depend on the sync fs apis,
// just expose everything
export * from 'memfs';

// needed for loading the j1 data model
export const readdirSync = jest.requireActual('fs').readdirSync;
