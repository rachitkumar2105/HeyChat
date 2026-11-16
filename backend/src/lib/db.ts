import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppError, fromDbMessage } from './errors.js';

export type DbArgs = Record<string, unknown>;

/**
 * Every query is a call to one hc_* Postgres function (see supabase/schema.sql).
 * Production calls them over HTTPS through Supabase's REST endpoint, so the API works on
 * hosts that only allow outbound 80/443 and never holds a pool of Postgres connections.
 * Tests call the exact same functions on a local Postgres through `pg`.
 */
export interface Db {
  call<T = unknown>(fn: string, args: DbArgs): Promise<T>;
  ping(): Promise<boolean>;
}

function toAppError(message: string | undefined, fn: string): AppError {
  return fromDbMessage(message) ?? new AppError(500, 'db_error', `Database call ${fn} failed`);
}

export class SupabaseDb implements Db {
  constructor(private readonly client: SupabaseClient) {}

  static create(url: string, serviceKey: string): SupabaseDb {
    return new SupabaseDb(
      createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { 'x-client-info': 'heychat-backend' } },
      }),
    );
  }

  get raw() {
    return this.client;
  }

  async call<T>(fn: string, args: DbArgs): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) {
      const appErr = fromDbMessage(error.message);
      if (appErr) throw appErr;
      const err = toAppError(error.message, fn);
      (err as Error & { cause?: unknown }).cause = error;
      throw err;
    }
    return data as T;
  }

  async ping(): Promise<boolean> {
    try {
      await this.call('hc_partner_ids', { p_user: '00000000-0000-0000-0000-000000000000' });
      return true;
    } catch {
      return false;
    }
  }
}

/** Minimal shape of a pg Pool so this file does not depend on pg at runtime. */
interface PgLike {
  query(text: string, values: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export class PgDb implements Db {
  constructor(private readonly pool: PgLike) {}

  async call<T>(fn: string, args: DbArgs): Promise<T> {
    if (!/^hc_[a-z_]+$/.test(fn)) throw new Error(`bad function name ${fn}`);
    const keys = Object.keys(args);
    for (const k of keys) if (!/^p_[a-z_]+$/.test(k)) throw new Error(`bad arg name ${k}`);
    const params = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const values = keys.map((k) => {
      const v = args[k];
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    try {
      const { rows } = await this.pool.query(`select ${fn}(${params}) as r`, values);
      return (rows[0]?.r ?? null) as T;
    } catch (e) {
      throw toAppError((e as Error).message, fn);
    }
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
