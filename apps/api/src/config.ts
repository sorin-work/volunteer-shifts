import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgres://volunteer:volunteer@localhost:5432/volunteer_shifts'),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 14),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  SEED_DEMO: z
    .enum(['true', 'false', '1', '0', ''])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  APP_URL: z.string().url().default('http://localhost:4420'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Volunteer Shifts <no-reply@volunteer-shifts.local>'),
  REMINDER_LEAD_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  REMINDER_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(10),
  ORG_NAME: z.string().default('Riverside Community Volunteers'),
  DIGEST_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(7),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid configuration:\n  ${issues.join('\n  ')}`);
  }
  return parsed.data;
}
