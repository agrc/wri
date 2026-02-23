import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('USERS', (table: Knex.CreateTableBuilder) => {
    table.integer('User_ID').primary();
    table.string('FirstName', 255);
    table.string('LastName', 255);
    table.integer('Agency').nullable();
    table.string('JobTitle', 255).nullable();
    table.integer('Office').nullable();
    table.string('OfficeAddress', 255).nullable();
    table.string('OfficePOBox', 255).nullable();
    table.string('OfficeCity', 255).nullable();
    table.string('OfficeState', 255).nullable();
    table.integer('OfficeZipCode').nullable();
    table.string('PhoneOffice', 255).nullable();
    table.string('PhoneMobile', 255).nullable();
    table.string('Email', 255).nullable();
    table.integer('Role').nullable();
    table.string('UserName', 255).nullable();
    table.string('umd_id', 255).nullable();
    table.string('user_group', 20).nullable();
    table.datetime('ExpireDate').nullable();
    table.string('UserKey', 64).nullable();
    table.string('Token', 128).nullable();
    table.string('RequestedAccess', 3).nullable();
    table.string('Active', 3).nullable();
    table.integer('esmf_user_id').nullable();
  });

  await knex.schema.createTable('CONTRIBUTOR', (table: Knex.CreateTableBuilder) => {
    table.increments('Contributor_ID').primary();
    table.integer('Project_FK').notNullable();
    table.integer('User_FK').notNullable();
  });

  const hasProjectManagerFk = await knex.schema.hasColumn('PROJECT', 'ProjectManager_FK');
  const hasProjectManagerId = await knex.schema.hasColumn('PROJECT', 'ProjectManager_ID');

  if (hasProjectManagerFk) {
    await knex.schema.alterTable('PROJECT', (table: Knex.AlterTableBuilder) => {
      table.renameColumn('ProjectManager_FK', 'ProjectManager_ID');
      table.string('Features').nullable();
    });
  } else {
    await knex.schema.alterTable('PROJECT', (table: Knex.AlterTableBuilder) => {
      if (!hasProjectManagerId) {
        table.integer('ProjectManager_ID').nullable();
      }
      table.string('Features').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasProjectManagerId = await knex.schema.hasColumn('PROJECT', 'ProjectManager_ID');

  if (hasProjectManagerId) {
    await knex.schema.alterTable('PROJECT', (table: Knex.AlterTableBuilder) => {
      table.renameColumn('ProjectManager_ID', 'ProjectManager_FK');
      table.dropColumn('Features');
    });
  } else {
    await knex.schema.alterTable('PROJECT', (table: Knex.AlterTableBuilder) => {
      table.dropColumn('Features');
    });
  }
  await knex.schema.dropTable('CONTRIBUTOR');
  await knex.schema.dropTable('USERS');
}
