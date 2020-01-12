#!/usr/bin/env node
const { lstat, readFile, readdir } = require('fs').promises;
const { join, resolve } = require('path');

const program = require('commander');

const { description, name, version } = require('../package.json');
const run = require('../src/lib.js');
const Logger = require('../src/logger.js');

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
      const resolved = children.map((c) => join(n, c));
      const jsonFiles = resolved.filter((p) => p.endsWith('.json'));
      yield* collectFiles(...jsonFiles);
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
        const spec = fPath.endsWith('.js')
          // eslint-disable-next-line max-len
          // eslint-disable-next-line import/no-dynamic-require,security/detect-non-literal-require,global-require
          ? require(fPath)
          : JSON.parse(await readFile(fPath, { encoding: 'utf-8' }));
        // eslint-disable-next-line no-empty,no-unused-vars
        for await (const _ of run(spec, { log })) {}
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
