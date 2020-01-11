const {red, yellow} = require('chalk');

class Logger {
  constructor (lvl = 0) {
    this.lvl = lvl;
  }

  _log (lvl, msg, fmt = (x) => x) {
    if (lvl >= this.lvl) {
      for (const m of msg) {
        process.stdout.write(fmt(typeof m === 'string' ? m : JSON.stringify(m)));
        process.stdout.write('\n');
      }
    }
  }

  debug (...msg) {
    return this._log(0, msg);
  }

  info (...msg) {
    return this._log(1, msg);
  }

  log (...msg) {
    return this._log(2, msg);
  }

  warn (...msg) {
    return this._log(3, msg, yellow);
  }

  error (...msg) {
    return this._log(4, msg, red);
  }

  startTime() {
    this._start = new Date().getTime();
  }

  endTime() {
    const diff = new Date().getTime() - this._start;
    return this.log(`took: ${diff}ms`);
  }
}

module.exports = Logger;
