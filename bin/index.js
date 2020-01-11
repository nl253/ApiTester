#!/usr/bin/env node
const fs = require('fs').promises;

const argv = require('yargs').command('test', 'use file').argv;

const f = require('../src/lib.js');

const fName = argv._[0];

(async () => {
  console.time('suite took');
  try {
    await f(JSON.parse(await fs.readFile(fName, { encoding: 'utf-8' })));
  } catch (e) {
    console.error(e);
  }
  console.log('');
  console.timeEnd('suite took');
})();
