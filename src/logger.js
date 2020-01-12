const { red, yellow } = require('chalk');

class Logger {
  constructor(lvl = 0) {
    this.lvl = lvl;
    this.START_TM = {};
  }

  /**
   * @param {number} lvl
   * @param {string[]} msg
   * @param {function(string): string} fmt
   */
  write(lvl, msg, fmt = (x) => x) {
    if (lvl >= this.lvl) {
      process.stdout.write(fmt(msg.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join(' ')));
      process.stdout.write('\n');
    }
  }

  /**
   * @param {...string} msg
   */
  debug(...msg) {
    return this.write(0, msg);
  }

  /**
   * @param {...string} msg
   */
  info(...msg) {
    return this.write(1, msg);
  }

  /**
   * @param {...string} msg
   */
  log(...msg) {
    return this.write(2, msg);
  }

  /**
   * @param {...string} msg
   */
  warn(...msg) {
    return this.write(3, msg, yellow);
  }

  /**
   * @param {...string} msg
   */
  error(...msg) {
    return this.write(4, msg, red);
  }

  startTime(label = 'main') {
    // @ts-ignore
    this.START_TM[label] = new Date().getTime();
  }

  endTime(label = 'main') {
    // @ts-ignore
    const diff = new Date().getTime() - this.START_TM[label];
    return this.log(`${label} took: ${diff}ms`);
  }
}

module.exports = Logger;
