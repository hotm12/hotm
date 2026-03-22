export function isDatabaseStorageEnabled() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function isDevSeedEnabled() {
  const explicitFlag = process.env.ENABLE_DEV_SEED?.trim().toLowerCase();

  if (explicitFlag === "true") {
    return true;
  }

  if (explicitFlag === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}
