import { readdir, readFile } from 'node:fs/promises';
import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/db/pool.js';

export async function runSql(kind) {
  if (!['migrations', 'seeds'].includes(kind)) throw new Error('Unsupported SQL operation');
  let database;
  let client;
  let locked = false;
  let currentFile;
  try {
    const config = loadEnv();
    if (kind === 'seeds' && config.NODE_ENV === 'production') {
      console.error('Demo seeds are disabled in production.');
      process.exitCode = 1;
      return;
    }
    // DDL may take longer than API queries. Use a bounded server-side timeout,
    // without a client timeout that could release a still-running query.
    database = createDatabase({ ...config, DB_QUERY_TIMEOUT_MS: 0, DB_POOL_MAX: 1 });
    client = await database.pool.connect();
    await client.query("SET statement_timeout = '120s'");
    await client.query("SET lock_timeout = '10s'");
    const lock = await client.query('SELECT pg_try_advisory_lock(173601, 1) AS acquired');
    locked = lock.rows[0].acquired;
    if (!locked) {
      console.error('Another migration/seed operation is running. Retry after it finishes.');
      process.exitCode = 1;
      return;
    }

    const directory = new URL(`../db/${kind}/`, import.meta.url);
    const files = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    if (!files.length) throw new Error('No SQL files found');
    const history = await client.query("SELECT to_regclass('public.schema_migrations') AS table_name");
    const applied = history.rows[0].table_name
      ? (await client.query('SELECT version FROM public.schema_migrations ORDER BY version')).rows.map((row) => row.version)
      : [];

    if (kind === 'migrations') {
      // A valid history is a prefix of the ordered local migration list.
      if (applied.some((name, index) => name !== files[index])) {
        console.error('Migration history does not match local file order. Inspect before proceeding.');
        process.exitCode = 1;
        return;
      }
    } else {
      const migrations = (await readdir(new URL('../db/migrations/', import.meta.url)))
        .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
      if (applied.length !== migrations.length || applied.some((name, index) => name !== migrations[index])) {
        console.error('Apply all local migrations before running demo seeds.');
        process.exitCode = 1;
        return;
      }
    }

    for (const file of files) {
      currentFile = file;
      if (kind === 'migrations' && applied.includes(file)) {
        console.log(`SKIP ${file}`);
        continue;
      }
      const sql = await readFile(new URL(file, directory), 'utf8');
      if (!sql.trim()) throw new Error('SQL file is empty');
      // Existing SQL files own BEGIN/COMMIT and migration history inserts.
      await client.query(sql);
      console.log(`APPLIED ${file}`);
    }
    console.log(`${kind} completed successfully.`);
  } catch (error) {
    // Never print error.detail/query/connection strings, which may contain secrets.
    const code = /^[A-Z0-9]{5}$/.test(error.code ?? '') ? ` (SQLSTATE ${error.code})` : '';
    console.error(`${kind} failed${currentFile ? ` at ${currentFile}` : ''}${code}. Check configuration and SQL; earlier committed files remain applied.`);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        await client.query('ROLLBACK');
        if (locked) await client.query('SELECT pg_advisory_unlock(173601, 1)');
      } catch {
        console.error('Connection cleanup failed; closing the connection.');
        process.exitCode = 1;
      }
      client.release(true);
    }
    await database?.close();
  }
}