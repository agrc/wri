import { https } from 'firebase-functions/v2';
import { Knex, knex } from 'knex';

const cors = [/ut-dts-agrc-wri-dev\.web\.app$/, /ut-dts-agrc-wri-prod\.web\.app$/];

const config: Knex.Config = {
  client: 'sqlite3',
  connection: {
    filename: './dev.sqlite3',
  },
  useNullAsDefault: true,
};

const knexInstance = knex(config);

export const project = https.onRequest({ cors }, async (req, res) => {
  const id = parseInt(req.query.id?.toString() ?? '-1', 10);
  console.log('query-string', id);

  const project = await knexInstance.select().from('PROJECT').where('Project_ID', id);

  res.send(project);
});
