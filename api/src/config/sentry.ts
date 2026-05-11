const dsn = process.env.SENTRY_DSN?.trim();

export const sentryEnabled = !!dsn;

export default {
  dsn,
};
