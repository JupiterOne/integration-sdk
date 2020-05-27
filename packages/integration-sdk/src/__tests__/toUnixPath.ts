/**
 * Utility for testing against the memfs vol.toJSON() result
 * on windows.
 */
export function toUnixPath(path: string) {
  const driveStrippedPath = path.replace(/^([A-Z]|[a-z]):\\/, '/');
  return driveStrippedPath.replace(/\\/g, '/');
}
