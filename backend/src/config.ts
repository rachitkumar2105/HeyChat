import { hkdfSync } from 'node:crypto';
import { z } from 'zod';

const csv = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(7860),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  STORAGE_BUCKET: z.string().default('heychat-media'),

  /** Optional master secret. When absent, signing keys are derived from the Supabase secret key. */
  APP_SECRET: z.string().min(32).optional(),

  /** Comma-separated exact origins allowed by CORS, e.g. https://heychat.vercel.app */
  CORS_ORIGINS: z.string().optional(),
  /** Optional regex for preview deployments, e.g. ^https://heychat-[a-z0-9-]+\.vercel\.app$ */
  CORS_ORIGIN_REGEX: z.string().optional(),

  /** Public base URL of this API (used to build media links). Render sets RENDER_EXTERNAL_URL. */
  PUBLIC_URL: z.url().optional(),
  RENDER_EXTERNAL_URL: z.url().optional(),
  SPACE_HOST: z.string().optional(),
  /** Number of reverse proxies in front of the app, for client IPs in rate limiting. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const e = parsed.data;
  const isProd = e.NODE_ENV === 'production';

  if (isProd && (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production');
  }

  const master = e.APP_SECRET ?? e.SUPABASE_SERVICE_ROLE_KEY;
  if (!master) {
    if (isProd) throw new Error('APP_SECRET or SUPABASE_SERVICE_ROLE_KEY is required');
  }
  const masterKey = master ?? 'development-only-insecure-master-secret-change-me';
  // Domain-separated keys derived with HKDF so one leaked key cannot forge another kind of token.
  const derive = (info: string) =>
    Buffer.from(hkdfSync('sha256', masterKey, 'heychat/v1', info, 32));

  const publicUrl =
    (e.PUBLIC_URL ?? e.RENDER_EXTERNAL_URL)?.replace(/\/+$/, '') ??
    (e.SPACE_HOST ? `https://${e.SPACE_HOST}` : `http://localhost:${e.PORT}`);

  const corsOrigins = csv(e.CORS_ORIGINS);
  if (!isProd) corsOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');

  return {
    env: e.NODE_ENV,
    isProd,
    port: e.PORT,
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    publicUrl,
    supabase:
      e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY
        ? { url: e.SUPABASE_URL, serviceKey: e.SUPABASE_SERVICE_ROLE_KEY }
        : null,
    storageBucket: e.STORAGE_BUCKET,
    cors: {
      origins: corsOrigins,
      regex: e.CORS_ORIGIN_REGEX ? new RegExp(e.CORS_ORIGIN_REGEX) : null,
    },
    keys: {
      access: derive('jwt-access'),
      media: derive('media-url'),
    },
    auth: {
      accessTtlSeconds: 15 * 60,
      refreshTtlSeconds: 30 * 24 * 60 * 60,
      issuer: 'heychat',
      audience: 'heychat-api',
    },
    limits: {
      textMax: 4000,
      captionMax: 1000,
      imageBytes: 10 * 1024 * 1024,
      voiceBytes: 10 * 1024 * 1024,
      voiceMaxSeconds: 300,
      avatarBytes: 5 * 1024 * 1024,
    },
  } as const;
}

export function isOriginAllowed(config: Config, origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (curl, health checks) send no Origin
  const o = origin.replace(/\/+$/, '');
  return config.cors.origins.includes(o) || (config.cors.regex?.test(o) ?? false);
}
