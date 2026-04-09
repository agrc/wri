import type { Knex } from 'knex';

const ACTIONS = ['Cultural Resource Inventory', 'Biological Surveys', 'Engineering', 'Other'] as const;
const FEATURE_TYPE = 'affected area';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const featureType = await trx('LU_FEATURETYPE')
      .select('FeatureTypeID')
      .whereRaw('LOWER(FeatureTypeDescription) = ?', [FEATURE_TYPE])
      .first<{ FeatureTypeID: number }>();

    if (!featureType) {
      throw new Error("LU_FEATURETYPE row for 'Affected Area' was not found");
    }

    const currentMaxActionIdResult = (await trx.raw(
      'SELECT ISNULL(MAX(ActionID), 0) AS maxActionId FROM dbo.LU_ACTION WITH (UPDLOCK, HOLDLOCK)',
    )) as { maxActionId?: number }[];

    let nextActionId = (currentMaxActionIdResult[0]?.maxActionId ?? 0) + 1;

    for (const actionDescription of ACTIONS) {
      let action = await trx('LU_ACTION')
        .select('ActionID')
        .whereRaw('LOWER(ActionDescription) = LOWER(?)', [actionDescription])
        .first<{ ActionID: number }>();

      if (!action) {
        action = { ActionID: nextActionId };

        await trx('LU_ACTION').insert({
          ActionID: action.ActionID,
          ActionDescription: actionDescription,
        });

        nextActionId += 1;
      }

      const existing = await trx('FEATURE_ACTION')
        .where({
          FeatureTypeID: featureType.FeatureTypeID,
          ActionID: action.ActionID,
        })
        .first();

      if (!existing) {
        await trx('FEATURE_ACTION').insert({
          FeatureTypeID: featureType.FeatureTypeID,
          ActionID: action.ActionID,
        });
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const featureType = await trx('LU_FEATURETYPE')
      .select('FeatureTypeID')
      .whereRaw('LOWER(FeatureTypeDescription) = ?', [FEATURE_TYPE])
      .first<{ FeatureTypeID: number }>();

    if (!featureType) {
      return;
    }

    const actions = (await trx('LU_ACTION')
      .select('ActionID', 'ActionDescription')
      .whereIn('ActionDescription', [...ACTIONS])) as { ActionID: number; ActionDescription: string }[];

    const actionIds = actions.map((action) => action.ActionID);

    if (actionIds.length === 0) {
      return;
    }

    await trx('FEATURE_ACTION')
      .where('FeatureTypeID', featureType.FeatureTypeID)
      .whereIn('ActionID', actionIds)
      .delete();

    await trx('LU_ACTION')
      .whereIn('ActionID', actionIds)
      .whereNotExists(function () {
        this.select(1).from('FEATURE_ACTION').whereRaw('FEATURE_ACTION.ActionID = LU_ACTION.ActionID');
      })
      .delete();
  });
}
