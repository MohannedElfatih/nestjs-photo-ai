import pg from 'pg';

/** Creates the e2e database if it doesn't exist. Needs Postgres running (docker start nest-pg). */
export default async function setup() {
  const database = process.env.DB_NAME_E2E ?? 'nestlearn_test';
  const client = new pg.Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: 'postgres', // connect to the maintenance database: ours may not exist yet
  });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(`Cannot reach Postgres for the e2e tests. Is the container running? (${String(error)})`);
  }

  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (!rowCount) await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }
}
