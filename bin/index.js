#!/usr/bin/env node
const { lstat, readFile } = require('fs').promises;
const { join } = require('path');

const program = require('commander');
const glob = require('glob');

const package = require('../package.json');
const runner = require('../src/lib.js');

/**
 * @param {string} file
 * @return {Promise<*[]>}
 */
const collectFiles = async file => {
  if ((await lstat(file)).isFile())  {
    return [file];
  }
  const files = await (new Promise(((resolve, reject) => glob(join(file, '*.json'), {}, (err, files) => err ? reject(err) : resolve(files)))));
  return files.filter(async p => (await lstat(p)).isFile());
};

program
.version(package.version)
.description(package.description)
.name(package.name)
.arguments('<file> [env]')
.action(async (file, env) => {
  for (const fName of await collectFiles(file)) {
    console.time('suite took');
    try {
      /** @type {string} */
      const text = await readFile(fName, { encoding: 'utf-8' });
      await runner(JSON.parse(text));
    } catch (e) {
      console.error(e);
    } finally {
      console.log('');
      console.timeEnd('suite took');
    }
  }
});

program.parse(process.argv);

