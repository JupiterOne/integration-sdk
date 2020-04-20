import path from 'path';

export function loadProjectStructure(fixtureName: string) {
  jest
    .spyOn(process, 'cwd')
    .mockReturnValue(
      path.resolve(__dirname, '..', '__fixtures__', fixtureName),
    );
}

export function restoreProjectStructure() {
  const maybeCwdMock = process.cwd;
  if (jest.isMockFunction(maybeCwdMock)) {
    maybeCwdMock.mockReset();
  }
}
