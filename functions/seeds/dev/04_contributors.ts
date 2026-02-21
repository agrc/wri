import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('CONTRIBUTOR').del();

  // Link the GROUP_PM user (User_ID: 4) to project 5772 as a contributor.
  // This exercises the CONTRIBUTOR path in the allowEdits check:
  //   - dev-pm-key / dev-pm-token on project 5772 → allowEdits: true (condition 5 via contributor)
  //   - dev-pm-key / dev-pm-token on project 1922 → allowEdits: false (condition 4: completed, non-admin)
  //     even though User_ID 4 is ProjectManager_ID on project 1922
  await knex('CONTRIBUTOR').insert([{ Project_FK: 5772, User_FK: 4 }]);
}
