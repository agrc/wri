import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'mssql',
  migrations: {
    directory: './migrations',
    extension: 'ts',
    loadExtensions: ['.ts'],
    tableName: 'knex_migrations',
  },
};

export default config;
