import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('PROJECT', (table: Knex.CreateTableBuilder) => {
    table.increments('Project_ID', { primaryKey: true });
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

  await knex.table('PROJECT').insert({
    ProjectManagerName: 'John Doe',
    LeadAgencyOrg: 'USFS',
    title: 'Test Project',
    Status: 'Active',
    Description: 'Test Description',
    ProjRegion: 'Region 1',
    AffectedAreaSqMeters: '100',
    TerrestrialSqMeters: '200',
    AqRipSqMeters: '300',
    EasementAcquisitionSqMeters: '400',
    StreamLnMeters: '500',
  });

  await knex.table('PROJECT').insert({
    ProjectManagerName: 'Jane Doe',
    LeadAgencyOrg: 'BLM',
    title: 'Another Project',
    Status: 'Planning',
    Description: 'Sample restoration project',
    ProjRegion: 'Region 2',
    AffectedAreaSqMeters: '1500',
    TerrestrialSqMeters: '800',
    AqRipSqMeters: '450',
    EasementAcquisitionSqMeters: '250',
    StreamLnMeters: '900',
  });
}

export async function down(knex: Knex): Promise<void> {
  knex.schema.dropTable('PROJECT');
}
