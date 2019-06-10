'use strict';

const { join, resolve } = require('path');
const fse = require('fs-extra');
const execa = require('execa');
const yargs = require('yargs');

async function run() {
  const argv = yargs.argv;

  const [argvDir] = argv._;

  if (!argvDir) {
    console.error('> You must provide a destination directory');
    process.exit(1);
  }

  const dir = resolve(argvDir);
  const monorepoDir = join(__dirname, '..');

  if (argv.f === true) {
    await fse.emptyDir(dir);
  }

  const list = await fse.readdir(dir);
  if (list.length > 0) {
    console.error(`> ${dir} isn't empty`);
    process.exit(1);
  }

  await fse.copy(join(monorepoDir, 'packages/strapi-generate-new/files'), dir);
  await fse.ensureDir(join(dir, 'api'));
  await fse.ensureDir(join(dir, 'extensions'));
  await fse.ensureDir(join(dir, 'admin'));

  await genTemplates({ dir, monorepoDir });

  // install
  await execa('yarn', { stdio: 'inherit', cwd: dir });
}

async function genTemplates(ctx) {
  return Promise.all(
    Object.keys(templates).map(async key => {
      const content =
        typeof templates[key] === 'function'
          ? templates[key](ctx)
          : templates[key];

      const out =
        typeof content === 'string'
          ? content
          : JSON.stringify(content, null, 4);

      await fse.writeFile(join(ctx.dir, key), out);
    })
  );
}

const databaseJSON = {
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'strapi-hook-bookshelf',
      settings: {
        client: 'sqlite',
        filename: '.tmp/data.db',
      },
      options: {
        useNullAsDefault: true,
      },
    },
  },
};

const templates = {
  'package.json': ({ monorepoDir }) => {
    return {
      name: 'app',
      private: true,
      version: '0.0.0',
      scripts: {
        start: 'strapi start',
        develop: 'strapi develop',
        build: 'strapi build',
        strapi: 'strapi',
      },
      dependencies: {
        knex: 'latest',
        sqlite: 'latest',
        ...buildPacakgeDeps(
          [
            'strapi',
            'strapi-admin',
            'strapi-hook-bookshelf',
            'strapi-hook-knex',
            'strapi-utils',
            'strapi-plugin-content-manager',
            'strapi-plugin-content-type-builder',
            'strapi-plugin-email',
            'strapi-plugin-settings-manager',
            'strapi-plugin-upload',
            'strapi-plugin-users-permissions',
            'strapi-plugin-graphql',
            'strapi-plugin-documentation',
          ],
          { dir: join(monorepoDir, 'packages') }
        ),
      },
    };
  },
  'config/environments/development/database.json': databaseJSON,
  'config/environments/staging/database.json': databaseJSON,
  'config/environments/production/database.json': databaseJSON,
};

function buildPacakgeDeps(pkgNames, { dir }) {
  return pkgNames.reduce((acc, name) => {
    acc[name] = `file:${join(dir, name)}`;
    return acc;
  }, {});
}

run().catch(error => {
  console.error(error);
});
