import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('STREAM', (table: Knex.CreateTableBuilder) => {
    table.integer('StreamId');
    table.integer('FeatureID');
    table.integer('ProjectID');
    table.string('StreamDescription');
    table.float('Intersection');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('STREAM');
}
