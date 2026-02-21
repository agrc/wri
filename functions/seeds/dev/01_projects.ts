import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('PROJECT').del();

  await knex('PROJECT').insert([
    {
      Project_ID: 1922,
      ProjectManagerName: 'John Doe',
      LeadAgencyOrg: 'Utah Division of Wildlife Resources',
      Title: 'Basin Canyon Project',
      Status: 'Completed',
      Description:
        'Project will consist of reseeding a perennial grass and forb mix within a mule deer winter range focus area. Project will also consist of spraying herbicide to control noxious weed issues prior to drill seeding the treatment area.',
      ProjRegion: 'Central',
      AffectedAreaSqMeters: '568538.41',
      TerrestrialSqMeters: '809371.28',
      AqRipSqMeters: '1214056.93',
      EasementAcquisitionSqMeters: '400',
      StreamLnMeters: '500',
      // PM user (User_ID: 4) is the manager; tests admin override of completed status
      ProjectManager_ID: 4,
      Features: 'Yes',
    },
    {
      Project_ID: 5772,
      ProjectManagerName: 'Jane Doe',
      LeadAgencyOrg: 'BLM',
      Title: 'Another Project',
      Status: 'Current',
      Description: 'Sample restoration project',
      ProjRegion: 'Region 2',
      AffectedAreaSqMeters: '1500',
      TerrestrialSqMeters: '800',
      AqRipSqMeters: '450',
      EasementAcquisitionSqMeters: '250',
      StreamLnMeters: '900',
      // No designated PM; PM user (User_ID: 4) is linked via CONTRIBUTOR instead
      ProjectManager_ID: null,
      Features: 'Yes',
    },
    {
      Project_ID: 6028,
      ProjectManagerName: 'Stan Gurley',
      LeadAgencyOrg: 'Utah Division of Wildlife Resources',
      Title: 'North Hills Sagebrush Habitat Enhancement and Water System',
      Status: 'Current',
      Description:
        'Install water system to distribute water across the landscape and harrow and seed 373 acres to increase grasses, forbs and regenerate browse species.   In areas that are harrowed we will install Zedyks structures in an effort to reduce erosion and and inc',
      ProjRegion: 'Southern',
      AffectedAreaSqMeters: null,
      TerrestrialSqMeters: '1508673.02607258',
      AqRipSqMeters: '43272.54981480',
      EasementAcquisitionSqMeters: null,
      StreamLnMeters: null,
      ProjectManager_ID: 917,
      Features: 'NO',
    },
  ]);
}
