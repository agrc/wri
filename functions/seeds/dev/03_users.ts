import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('USERS').del();

  // Four users — one per user_group value — for local development auth testing.
  // Use the UserKey + Token pairs in .env.local (VITE_DEV_USER_KEY / VITE_DEV_USER_TOKEN)
  // to simulate different permission levels without credentials ever being committed.
  await knex('USERS').insert([
    {
      User_ID: 1,
      FirstName: 'Admin',
      LastName: 'User',
      user_group: 'GROUP_ADMIN',
      UserKey: 'dev-admin-key',
      Token: 'dev-admin-token',
      Active: 'YES',
    },
    {
      User_ID: 2,
      FirstName: 'Public',
      LastName: 'User',
      user_group: 'GROUP_PUBLIC',
      UserKey: 'dev-public-key',
      Token: 'dev-public-token',
      Active: 'YES',
    },
    {
      User_ID: 3,
      FirstName: 'Anonymous',
      LastName: 'User',
      user_group: 'GROUP_ANONYMOUS',
      UserKey: 'dev-anon-key',
      Token: 'dev-anon-token',
      Active: 'YES',
    },
    {
      User_ID: 4,
      FirstName: 'Project',
      LastName: 'Manager',
      user_group: 'GROUP_PM',
      UserKey: 'dev-pm-key',
      Token: 'dev-pm-token',
      Active: 'YES',
    },
  ]);
}
