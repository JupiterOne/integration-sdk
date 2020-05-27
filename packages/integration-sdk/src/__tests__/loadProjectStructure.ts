import path from 'path';

export function getProjectDirectoryPath(fixtureName: string) {
  return path.resolve(__dirname, '__fixtures__', fixtureName);
}

export function loadProjectStructure(fixtureName: string) {
  jest
    .spyOn(process, 'cwd')
    .mockReturnValue(getProjectDirectoryPath(fixtureName));
}

export function restoreProjectStructure() {
  const maybeCwdMock = process.cwd;
  if (jest.isMockFunction(maybeCwdMock)) {
    maybeCwdMock.mockRestore();
  }
}
