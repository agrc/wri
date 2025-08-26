import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('PROJECT', (table: Knex.CreateTableBuilder) => {
    table.integer('Project_ID').unique().primary();
    table.string('ProjectManagerName');
    table.string('LeadAgencyOrg');
    table.string('title');
    table.string('Status');
    table.string('Description');
    table.string('ProjRegion');
    table.string('AffectedAreaSqMeters');
    table.string('TerrestrialSqMeters');
    table.string('AqRipSqMeters');
    table.string('EasementAcquisitionSqMeters');
    table.string('StreamLnMeters');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('PROJECT');
}
