import { createServer } from 'node:http';
import path from 'node:path';
import { pino } from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContext } from './context.js';
import { SupabaseDb, type Db } from './lib/db.js';
import { LocalStorage, SupabaseStorage, type Storage } from './lib/storage.js';
import { attachRealtime } from './realtime/socket.js';

async function main() {
  const config = loadConfig();
  const log = pino({ level: config.logLevel, base: { svc: 'heychat-api' } });

  let db: Db;
  let storage: Storage;
  if (config.supabase) {
    const supa = SupabaseDb.create(config.supabase.url, config.supabase.serviceKey);
    db = supa;
    storage = new SupabaseStorage(supa.raw, config.storageBucket);
  } else {
    // Local development against a plain Postgres: DATABASE_URL + files on disk.
    const { default: pg } = await import('pg');
    const { PgDb } = await import('./lib/db.js');
    db = new PgDb(new pg.Pool({ connectionString: process.env.DATABASE_URL }));
    storage = new LocalStorage(path.resolve(process.env.LOCAL_STORAGE_DIR ?? '.data/media'));
    log.warn('Supabase not configured: using DATABASE_URL and local disk storage');
  }

  const ctx = createContext(config, db, storage, log);
  const app = createApp(ctx);
  const server = createServer(app);
  server.requestTimeout = 120_000;
  server.headersTimeout = 30_000;
  const io = attachRealtime(ctx, server);

  server.listen(config.port, '0.0.0.0', () => {
    log.info({ port: config.port, publicUrl: config.publicUrl, origins: config.cors.origins }, 'HeyChat API listening');
  });

  const shutdown = (signal: string) => {
    log.info({ signal }, 'shutting down');
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => log.error({ err }, 'unhandled rejection'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
