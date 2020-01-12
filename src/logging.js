const {
  cyan,
  green,
  magenta,
  yellow,
} = require('chalk');

// eslint-disable-next-line no-unused-vars
const Logger = require('./logger');
const { fmtHeaders } = require('./utils');

/**
 * @param {{name: string, path: string, description: string}} suite
 * @param {Logger} log
 */
const logSuite = ({ name, path, description }, log) => {
  if (name) {
    log.log(cyan(`Test Suite :: ${name} ${path}\n`));
  } else {
    log.log(cyan(`Test Suite :: ${path}\n`));
  }
  if (description) {
    log.info(description);
  }
};
/**
 * @param {{name: string, description: string}} test
 * @param {Logger} log
 */
const logTest = ({ name, description }, log) => {
  log.log(magenta(name));
  if (description) {
    log.info(description);
  }
};

/**
 * @param {{
 *  query: Record<string, string>,
 *  headers: Record<string, string>,
 *  method: string,
 *  path: string,
 *  description: string}} request
 * @param {Logger} log
 */
const logRequest = ({
  headers, query, method, path, description,
}, log) => {
  log.log('');
  if (Object.keys(query).length === 0) {
    log.log(yellow(`${method.toUpperCase()} ${path}`));
  } else {
    const queryJoined = Object.entries(query)
      .map((pair) => pair.join('='))
      .join('&');
    log.log(yellow(`${method.toUpperCase()} ${path}?${queryJoined}`));
  }
  log.log('');
  if (description) {
    log.info(description);
  }
  log.debug(fmtHeaders(headers));
  log.debug('');
};

/**
 * @param {{
 *  statusMessage: string,
 *  statusCode: number,
 *  body: *,
 *  headers: Record<string, string>}} response
 * @param {Logger} log
 */
const logResponse = ({
  headers, body, statusCode, statusMessage,
}, log) => {
  log.log(green(`\n${statusMessage.toUpperCase()} ${statusCode}\n`));
  log.debug(fmtHeaders(headers));
  log.debug('');
  log.debug(body);
  log.debug('');
};

module.exports = {
  logSuite,
  logTest,
  logRequest,
  logResponse,
};
