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

  await knex.table('COUNTY').insert([
    {
      COUNTY_ID: 49039,
      FeatureID: 3960,
      FeatureClass: 'POLY',
      CountyInfoID: 13406,
      County: 'SANPETE',
      Intersection: 443479.03,
    },
    {
      COUNTY_ID: 4127,
      FeatureID: 3960,
      FeatureClass: 'POLY',
      CountyInfoID: 13407,
      County: 'SANPETE',
      Intersection: 125059.47,
    },
    {
      COUNTY_ID: 49039,
      FeatureID: 10354,
      FeatureClass: 'POLY',
      CountyInfoID: 22320,
      County: 'SANPETE',
      Intersection: 562344.14,
    },
  ]);

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

  await knex.table('POLY').insert([
    {
      FeatureID: 3960,
      TypeDescription: 'Terrestrial Treatment Area',
      TypeCode: 1,
      Project_ID: 1922,
      StatusDescription: 'Completed',
      StatusCode: 5,
      AreaSqMeters: 443479.02900905,
    },
    {
      FeatureID: 4127,
      TypeDescription: 'Terrestrial Treatment Area',
      TypeCode: 1,
      Project_ID: 1922,
      StatusDescription: 'Completed',
      StatusCode: 5,
      AreaSqMeters: 125059.47220436,
    },
    {
      FeatureID: 10354,
      TypeDescription: 'Terrestrial Treatment Area',
      TypeCode: 1,
      Project_ID: 5772,
      StatusDescription: 'Current',
      StatusCode: 5,
      AreaSqMeters: 562344.13737306,
      Retreatment: 'Y',
    },
  ]);

  await knex.schema.createTable('AreaACTION', (table: Knex.CreateTableBuilder) => {
    table.integer('AreaActionId').unique().primary();
    table.integer('FeatureID');
    table.integer('ActionID');
    table.string('ActionDescription');
  });

  await knex.table('AreaACTION').insert([
    {
      AreaActionId: 4001,
      FeatureID: 4127,
      ActionID: 32,
      ActionDescription: 'Seeding (primary)',
    },
    {
      AreaActionId: 4002,
      FeatureID: 3960,
      ActionID: 32,
      ActionDescription: 'Seeding (primary)',
    },
    {
      AreaActionId: 4506,
      FeatureID: 4127,
      ActionID: 7,
      ActionDescription: 'Chain harrow',
    },
    {
      AreaActionId: 17199,
      FeatureID: 10354,
      ActionID: 16,
      ActionDescription: 'Herbicide application',
    },
  ]);

  await knex.schema.createTable('AreaTreatment', (table: Knex.CreateTableBuilder) => {
    table.integer('AreaTreatmentID').unique().primary();
    table.integer('AreaActionID');
    table.integer('TreatmentTypeID');
    table.string('TreatmentTypeDescription');
  });

  await knex.table('AreaTreatment').insert([
    {
      AreaTreatmentID: 18349,
      AreaActionID: 17199,
      TreatmentTypeID: 8,
      TreatmentTypeDescription: 'Aerial (helicopter)',
    },
    {
      AreaTreatmentID: 7095,
      AreaActionID: 4001,
      TreatmentTypeID: 51,
      TreatmentTypeDescription: 'Ground (mechanical application)',
    },
    {
      AreaTreatmentID: 7094,
      AreaActionID: 4506,
      TreatmentTypeID: 3,
      TreatmentTypeDescription: '<= 15 ft. (2-way)',
    },
    {
      AreaTreatmentID: 7097,
      AreaActionID: 4002,
      TreatmentTypeID: 33,
      TreatmentTypeDescription: 'Drill (rangeland)',
    },
  ]);

  await knex.schema.createTable('AREAHERBICIDE', (table: Knex.CreateTableBuilder) => {
    table.integer('AreaHerbicideID').unique().primary();
    table.integer('AreaTreatmentID');
    table.integer('HerbicideID');
    table.string('HerbicideDescription');
  });

  await knex
    .table('AREAHERBICIDE')
    .insert([{ AreaHerbicideID: 2730, AreaTreatmentID: 18349, HerbicideID: 22, HerbicideDescription: 'Plateau' }]);

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

  await knex.table('LANDOWNER').insert([
    {
      FeatureID: 10354,
      FeatureClass: 'POLY',
      LandownerID: 22607,
      Owner: 'State',
      Admin: 'UDWR',
      Intersection: 562116.61,
    },
    {
      FeatureID: 10354,
      FeatureClass: 'POLY',
      LandownerID: 22608,
      Owner: 'Private',
      Admin: 'Private',
      Intersection: 226.69,
    },
    {
      FeatureID: 2960,
      FeatureClass: 'POLY',
      LandownerID: 2919,
      Owner: 'Private',
      Admin: 'Private',
      Intersection: 443479.03,
    },
    {
      FeatureID: 4127,
      FeatureClass: 'POLY',
      LandownerID: 2920,
      Owner: 'Private',
      Admin: 'Private',
      Intersection: 125059.47,
    },
  ]);
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
