#!/usr/bin/env node
const {lstat, readFile, readdir} = require('fs').promises;
const {join, resolve} = require('path');

const program = require('commander');

const {description, name, version} = require('../package.json');
const runner = require('../src/lib.js');

/**
 * @param {...string} nodes
 */
async function* collectFiles(...nodes) {
  /**
   * @type {Array<Promise<Array<string>>>}
   */
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
}

program.version(version).
  description(description).
  name(name).
  arguments('<file> [files...]').
  action(async (file, files) => {
    for await (const fPath of collectFiles(file, ...files)) {
      console.time('suite took');
      try {
        await runner(
          fPath.endsWith('.js')
            ? require(fPath)
            : JSON.parse(await readFile(fPath, { encoding: 'utf-8' })));
      } catch (e) {
        console.error(e);
      } finally {
        console.log('');
        console.timeEnd('suite took');
      }
    }
  });

program.parse(process.argv);

