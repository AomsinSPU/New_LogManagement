import pg from 'pg';

export function createDatabase(config) {
  const pool = new pg.Pool({
    ...(config.DATABASE_URL ? { connectionString: config.DATABASE_URL } : {
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.POSTGRES_DB,
      user: config.POSTGRES_USER,
      password: config.POSTGRES_PASSWORD,
    }),
    ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
    max: config.DB_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: config.DB_CONNECT_TIMEOUT_MS,
    statement_timeout: config.DB_QUERY_TIMEOUT_MS,
    query_timeout: config.DB_QUERY_TIMEOUT_MS,
    application_name: 'logmanagement-backend',
  });

  // Do not log connection strings or database error details containing user data.
  pool.on('error', () => console.error('An idle database connection failed.'));
  let closing;
  return {
    pool,
    async check() { await pool.query('SELECT 1'); },
    close() { closing ??= pool.end(); return closing; },
  };
}
