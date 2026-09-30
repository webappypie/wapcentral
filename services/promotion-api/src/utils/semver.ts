/**
 * Semantic version comparison utility for targeting rules.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/i, '').split('-')[0] || '';
  const clean2 = v2.replace(/^v/i, '').split('-')[0] || '';

  const p1 = clean1.split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = clean2.split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks whether an app version satisfies minimum and maximum version constraints.
 */
export function isVersionInRange(
  version: string,
  minVersion?: string,
  maxVersion?: string,
): boolean {
  if (minVersion && compareSemver(version, minVersion) < 0) {
    return false;
  }
  if (maxVersion && compareSemver(version, maxVersion) > 0) {
    return false;
  }
  return true;
}
