#!/usr/bin/env node
const {lstat, readFile, readdir} = require('fs').promises;
const {join, resolve} = require('path');

const program = require('commander');

const {description, name, version} = require('../package.json');
const run = require('../src/lib.js');
const Logger = require('./logger');

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
  .option('--logging <n>', 'Set logging threshold', '2')
  .arguments('<file> [files...]')
  .action(async (file, files, { silent, logging }) => {
    const log = new Logger(silent === true ? 3 : parseInt(logging));
    for await (const fPath of collectFiles(file, ...files)) {
      log.startTime();
      try {
      // eslint-disable-next-line no-unused-vars
        const opts = { log };
        const spec = fPath.endsWith('.js')
          ? require(fPath)
          : JSON.parse(await readFile(fPath, {encoding: 'utf-8'}));
        // eslint-disable-next-line no-empty
        for await (const _ of run(spec, opts)) {}
      } catch (e) {
        log.error(`ERROR ${e.message}`);
      } finally {
        log.log('');
        log.endTime();
      }
    }
  });

// eslint-disable-next-line no-undef
program.parse(process.argv);
