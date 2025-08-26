import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('PROJECT').del();

  await knex('PROJECT').insert([
    {
      Project_ID: 1922,
      ProjectManagerName: 'John Doe',
      LeadAgencyOrg: 'Utah Division of Wildlife Resources',
      title: 'Basin Canyon Project',
      Status: 'Completed',
      Description:
        'Project will consist of reseeding a perennial grass and forb mix within a mule deer winter range focus area. Project will also consist of spraying herbicide to control noxious weed issues prior to drill seeding the treatment area.',
      ProjRegion: 'Central',
      AffectedAreaSqMeters: '140.4889 ac',
      TerrestrialSqMeters: '200 ac',
      AqRipSqMeters: '300 ac',
      EasementAcquisitionSqMeters: '400',
      StreamLnMeters: '500',
    },
    {
      Project_ID: 5772,
      ProjectManagerName: 'Jane Doe',
      LeadAgencyOrg: 'BLM',
      title: 'Another Project',
      Status: 'Current',
      Description: 'Sample restoration project',
      ProjRegion: 'Region 2',
      AffectedAreaSqMeters: '1500',
      TerrestrialSqMeters: '800',
      AqRipSqMeters: '450',
      EasementAcquisitionSqMeters: '250',
      StreamLnMeters: '900',
    },
  ]);
}
