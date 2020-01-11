#!/usr/bin/env node
const {lstat, readFile, readdir} = require('fs').promises;
const {join, resolve} = require('path');

const program = require('commander');
const {red, yellow} = require('chalk');

const {description, name, version} = require('../package.json');
const run = require('../src/lib.js');

console._error = console.error;
console.error = (...msg) => console._error(red(msg.map(m => m.toString()).join(' ')));

console._warn = console.warn;
console.warn = (...msg) => console._warn(yellow(msg.map(m => m.toString()).join(' ')));

/**
 * @param {...string} nodes
 */
const collectFiles = async function* (...nodes) {
  for (const n of nodes) {
    const stats = await lstat(n);
    if (stats.isFile()) {
      yield resolve(n);
    } else if (stats.isDirectory()) {
      const children = await readdir(n);
      for (const c of children.map(c => join(n, c))) {
        const s = await lstat(c);
        if (s.isDirectory()) {
          yield* collectFiles(c);
        } else if (s.isFile() && c.endsWith('.json')) {
          yield c;
        }
      }
    }
  }
};

program
  .version(version)
  .description(description)
  .name(name)
  .option('--silent', 'Only report failures', false)
  .arguments('<file> [files...]')
  .action(async (file, files, { silent }) => {
    for await (const fPath of collectFiles(file, ...files)) {
      console.time('suite took');
      try {
      // eslint-disable-next-line no-unused-vars
        const opts = { silent };
        const spec = fPath.endsWith('.js')
          ? require(fPath)
          : JSON.parse(await readFile(fPath, {encoding: 'utf-8'}));
        // eslint-disable-next-line no-empty
        for await (const _ of run(spec, opts)) {}
        console.log('');
        console.timeEnd('suite took');
      } catch (e) {
        console.log('');
        console.error('ERROR', e.message);
      }
    }
  });

// eslint-disable-next-line no-undef
program.parse(process.argv);
