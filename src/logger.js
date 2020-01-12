const { red, yellow } = require('chalk');

class Logger {
  constructor(lvl = 0) {
    this.lvl = lvl;
  }

  write(lvl, msg, fmt = (x) => x) {
    if (lvl >= this.lvl) {
      msg.forEach((m) => {
        process.stdout.write(fmt(typeof m === 'string' ? m : JSON.stringify(m)));
        process.stdout.write('\n');
      });
    }
  }

  debug(...msg) {
    return this.write(0, msg);
  }

  info(...msg) {
    return this.write(1, msg);
  }

  log(...msg) {
    return this.write(2, msg);
  }

  warn(...msg) {
    return this.write(3, msg, yellow);
  }

  error(...msg) {
    return this.write(4, msg, red);
  }

  startTime() {
    this.START_TM = new Date().getTime();
  }

  endTime() {
    const diff = new Date().getTime() - this.START_TM;
    return this.log(`took: ${diff}ms`);
  }
}

module.exports = Logger;
