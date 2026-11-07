function parseOrigins(value) {
  return String(value ?? "http://localhost:5173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = Object.freeze({
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: process.env.DATABASE_URL,
  ALLOWED_ORIGINS: parseOrigins(process.env.ALLOWED_ORIGINS),
  SCAN_INTERVAL_MS: Number(process.env.SCAN_INTERVAL_MS ?? 30000),
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD,
});
