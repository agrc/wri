import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  let table = 'COUNTY';
  await knex(table).del();
  await knex(table).insert([
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

  table = 'POLY';
  await knex(table).del();
  await knex(table).insert([
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

  table = 'LINE';
  await knex(table).del();
  await knex(table).insert([
    {
      FeatureID: 5,
      TypeDescription: 'Fence',
      TypeCode: 10,
      FeatureSubTypeID: 1,
      FeatureSubTypeDescription: 'Barbed wire',
      ActionID: 8,
      ActionDescription: 'Construction',
      Description: null,
      Project_FK: '07FFF610-6170-4625-98DC-1BA62645BE0D',
      Project_ID: 1922,
      StatusDescription: 'Completed',
      StatusCode: 5,
      LengthLnMeters: 3100.67,
    },
    {
      FeatureID: 13,
      TypeDescription: 'Fence',
      TypeCode: 10,
      FeatureSubTypeID: 5,
      FeatureSubTypeDescription: 'Pole top',
      ActionID: 8,
      ActionDescription: 'Construction',
      Description: null,
      Project_FK: 'A493D78A-8CEC-4C37-8373-5DCA302B532B',
      Project_ID: 5772,
      StatusDescription: 'Cancelled',
      StatusCode: 6,
      LengthLnMeters: 467.75,
    },
  ]);

  table = 'AreaACTION';
  await knex(table).del();
  await knex(table).insert([
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

  table = 'AreaTreatment';
  await knex(table).del();
  await knex(table).insert([
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

  table = 'AREAHERBICIDE';
  await knex(table).del();
  await knex(table).insert([
    { AreaHerbicideID: 2730, AreaTreatmentID: 18349, HerbicideID: 22, HerbicideDescription: 'Plateau' },
  ]);

  table = 'LANDOWNER';
  await knex(table).del();
  await knex(table).insert([
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

  table = 'SGMA';
  await knex(table).del();
  await knex(table).insert([
    {
      FeatureID: 3960,
      FeatureClass: 'POLY',
      SGMA_ID: 1133,
      SGMA: 'Bald Hills',
      Intersection: 1891838.47,
    },
  ]);
}
