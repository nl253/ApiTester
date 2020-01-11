const fs = require('fs').promises;

const f = require('./lib');

const fName = process.argv[process.argv.length - 1];

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
