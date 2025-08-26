import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('COUNTY', (table: Knex.CreateTableBuilder) => {
    table.integer('COUNTY_ID');
    table.integer('FeatureID');
    table.string('FeatureClass');
    table.integer('CountyInfoID');
    table.string('County');
    table.float('Intersection');
  });

  await knex.schema.createTable('POINT', (table: Knex.CreateTableBuilder) => {
    table.integer('FeatureID').unique().primary();
    table.string('TypeDescription');
    table.string('Description');
    table.integer('TypeCode');
    table.integer('FeatureSubTypeID');
    table.string('FeatureSubTypeDescription');
    table.integer('ActionID');
    table.string('ActionDescription');
    table.integer('Project_FK').unique();
    table.integer('Project_ID');
    table.string('StatusDescription');
    table.integer('StatusCode');
    table.point('Shape');
  });

  await knex.schema.createTable('LINE', (table: Knex.CreateTableBuilder) => {
    table.integer('FeatureID').unique().primary();
    table.string('TypeDescription');
    table.integer('TypeCode');
    table.integer('FeatureSubTypeID');
    table.string('FeatureSubTypeDescription');
    table.integer('ActionID');
    table.string('ActionDescription');
    table.string('Description');
    table.integer('Project_FK').unique();
    table.integer('Project_ID');
    table.string('StatusDescription');
    table.integer('StatusCode');
    table.geometry('Shape');
    table.float('LengthLnMeters');
  });

  await knex.schema.createTable('POLY', (table: Knex.CreateTableBuilder) => {
    table.integer('FeatureID').unique().primary();
    table.string('TypeDescription');
    table.integer('TypeCode');
    table.integer('Project_ID');
    table.string('StatusDescription');
    table.integer('StatusCode');
    table.geometry('Shape');
    table.float('AreaSqMeters');
    table.string('Retreatment', 1);
  });

  await knex.schema.createTable('AreaACTION', (table: Knex.CreateTableBuilder) => {
    table.integer('AreaActionId').unique().primary();
    table.integer('FeatureID');
    table.integer('ActionID');
    table.string('ActionDescription');
  });

  await knex.schema.createTable('AreaTreatment', (table: Knex.CreateTableBuilder) => {
    table.integer('AreaTreatmentID').unique().primary();
    table.integer('AreaActionID');
    table.integer('TreatmentTypeID');
    table.string('TreatmentTypeDescription');
  });

  await knex.schema.createTable('AREAHERBICIDE', (table: Knex.CreateTableBuilder) => {
    table.integer('AreaHerbicideID').unique().primary();
    table.integer('AreaTreatmentID');
    table.integer('HerbicideID');
    table.string('HerbicideDescription');
  });

  await knex.schema.createTable('SGMA', (table: Knex.CreateTableBuilder) => {
    table.integer('FeatureID').unique().primary();
    table.integer('SGMA_ID');
    table.string('FeatureClass');
    table.string('SGMA');
    table.float('Intersection');
  });

  await knex.schema.createTable('LANDOWNER', (table: Knex.CreateTableBuilder) => {
    table.integer('LandownerID').unique().primary();
    table.integer('FeatureID');
    table.string('FeatureClass');
    table.string('Owner');
    table.string('Admin');
    table.float('Intersection');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('COUNTY');
  await knex.schema.dropTable('POINT');
  await knex.schema.dropTable('LINE');
  await knex.schema.dropTable('POLY');
  await knex.schema.dropTable('LANDOWNER');
  await knex.schema.dropTable('SGMA');
  await knex.schema.dropTable('AREAHERBICIDE');
  await knex.schema.dropTable('AreaTreatment');
  await knex.schema.dropTable('AreaACTION');
}
