function boolEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

export function isDemoModeEnabled(): boolean {
  if (process.env.DEMO_MODE !== undefined) {
    return boolEnv(process.env.DEMO_MODE);
  }

  return true;
}
