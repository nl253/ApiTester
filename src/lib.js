const {join} = require('path');
const {assert} = require('chai');

const {cyan, green, magenta, yellow} = require('chalk');
const rp = require('request-promise-native');

const Ajv = require('ajv');
const ajv = new Ajv({allErrors: true});

/**
 * @param {Record<string, string>} headers
 * @return {Record<string, string>}
 */
const normalizeHeaders = headers => {
  const fn = ([header, value]) => [header.toLocaleLowerCase(), value];
  return Object.fromEntries(Object.entries(headers).map(fn));
};

/**
 * @param {Record<string, string>} headers
 */
const fmtHeaders = headers => {
  const padding = Object.keys(headers).
    map(k => k.length).
    reduce((x, y) => Math.max(x, y));
  const fn = ([header, value]) => `${header.padEnd(
    padding)} ${value.toString()}`;
  return Object.entries(headers).map(fn).join('\n');
};

/**
 * @param {{name: string, path: string, description: string}} suite
 * @param {Logger} log
 */
const logSuite = ({name, path, description}, log) => {
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
const logTest = ({name, description}, log) => {
  log.log(magenta(name));
  if (description) {
    log.info(description);
  }
};

/**
 * @param {{query: Record<string, string>, headers: Record<string, string>, method: string, path: string, description: string}} request
 * @param {Logger} log
 */
const logRequest = ({headers, query, method, path, description}, log) => {
  log.log('');
  if (Object.keys(query).length === 0) {
    log.log(yellow(`${method.toUpperCase()} ${path}`));
  } else {
    const queryJoined = Object.entries(query).
      map(pair => pair.join('=')).
      join('&');
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
 * @param {{statusMessage: string, statusCode: number, body: *, headers: Record<string, string>}} response
 * @param {Logger} log
 */
const logResponse = ({headers, body, statusCode, statusMessage}, log) => {
  log.log(green(`\n${statusMessage.toUpperCase()} ${statusCode}\n`));
  log.debug(fmtHeaders(headers));
  log.debug('');
  log.debug(body);
  log.debug('');
};

const getSchemaErrMsg = validate => {
  return validate.errors.map(e => [
    e.message,
    e.data,
    e.dataPath,
    e.keyword,
    e.propertyName,
    e.schemaPath,
  ].map(info => info || '')
    .filter(Boolean)
    .map(info => info.toString())
    .join(', '),
  ).join(', ');
};

/**
 * @param {{mode: ('exact'|'schema'), description: string, method: string, parse: boolean, body: *, headers: Record<string, string>, path: string, query: Record<string, string>, response: {body: *, status: number, headers: Record<string, string>}}} request
 * @param {{log: Logger}} opts
 * @return {Promise<void>}
 */
const runRequest = async (request, {log}) => {
  logRequest(request, log);
  log.startTime();
  const res = await rp({
    uri: `https://${(request.path)}`,
    method: request.method,
    headers: request.headers,
    qs: request.query,
    body: request.body,
    json: request.parse,
    resolveWithFullResponse: true,
  });
  log.endTime();
  res.headers = normalizeHeaders(res.headers);
  logResponse(res, log);
  assert.equal(res.statusCode, request.response.status);
  for (const k in request.response.headers) {
    assert.equal(!!res.headers[k], true, `header ${k} is on response`);
    assert.equal(res.headers[k], request.response.headers[k]);
  }
  if (request.mode === 'exact') {
    assert.deepEqual(res.body, request.response.body);
  } else if (request.mode === 'schema') {
    const validate = ajv.compile(request.response.body);
    const valid = validate(res.body);
    if (!valid) {
      throw new Error(`schema validation failed ${getSchemaErrMsg(validate)}`);
    }
  } else {
    throw new Error(`mode ${request.mode || 'undefined'} not implemented yet`);
  }
  log.info(green('[PASS]'));
};

/**
 * @param {{name: string, description: string, mode: ('schema'|'exact'), request: {}[], method: string, parse: boolean, headers: Record<string, string>, query: Record<string, string>, path: string, response: {}}} test
 * @param {{log: Logger}} opts
 */
const runTest = async function* (test, {log}) {
  logTest(test, log);
  for (let rIdx = 0; rIdx < test.request.length; rIdx++) {
    const r = (test.request)[rIdx];
    yield runRequest({
      name: `Request #${rIdx}`,
      method: test.method,
      mode: test.mode,
      parse: test.parse,
      description: '',
      ...r,
      response: {
        status: test.response.status,
        ...(r.response || {}),
        ...(test.response),
        headers: normalizeHeaders({
          ...test.response.headers,
          ...((r.response || {headers: {}}).headers || {}),
        }),
      },
      path: join(test.path, r.path || ''),
      headers: normalizeHeaders({...(test.headers), ...r.headers}),
      query: {...(test.query), ...r.query},
    }, {log});
  }
  log.log('');
};

/**
 * @param {{method: string, name: string, description: string, parse: boolean, mode: ('exact'|'schema'), response: {}, path: string, headers: Record<string, string>, tests: {}[], query: Record<string, string>}} suite
 * @param {{log: Logger}} opts
 */
const runSuite = async function* (suite, {log}) {
  logSuite(suite, log);
  for (let tIdx = 0; tIdx < suite.tests.length; tIdx++) {
    const t = (suite.tests)[tIdx];
    const endpoint = join(suite.path, t.path || '');
    yield* runTest({
      name: `Test Case #${tIdx} :: ${endpoint}`,
      method: suite.method,
      parse: suite.parse,
      mode: suite.mode,
      description: '',
      ...t,
      request: Array.isArray(t.request) ? t.request : [t.request],
      response: {
        status: suite.response.status,
        ...(t.response || {}),
        ...(suite.response),
        headers: {
          ...suite.response.headers,
          ...((t.response || {headers: {}}).headers || {}),
        },
      },
      path: endpoint,
      headers: {...(suite.headers), ...t.headers},
      query: {...(suite.query), ...t.query},
    }, {log});
  }
};

/**
 * @param {{}} s
 * @param {{log: Logger}} opts
 */
const run = (s, {log}) => runSuite({
  name: '',
  method: 'get',
  query: {},
  description: '',
  headers: {},
  path: '',
  parse: true,
  mode: 'schema',
  tests: [],
  ...s,
  response: {
    status: 200,
    headers: {},
    ...(s.response || {}),
  },
}, {log});

module.exports = run;
