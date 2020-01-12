const { join } = require('path');
const { assert } = require('chai');

const { green } = require('chalk');
const rp = require('request-promise-native');

const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true });

const { normalizeHeaders, getSchemaErrMsg } = require('./utils');
const {
  logSuite,
  logTest,
  logRequest,
  logResponse,
} = require('./logging');

/**
 * @param {{
 *   mode: ('exact'|'schema'),
 *   description: string,
 *   method: string,
 *   parse: boolean,
 *   body: *,
 *   headers: Record<string, string>,
 *   path: string,
 *   query: Record<string, string>,
 *   response: {body: *, status: number, headers: Record<string, string>}}} request
 * @param {{log: Logger}} opts
 * @return {Promise<void>}
 */
const runRequest = async (request, { log }) => {
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
  for (const k of Object.keys(request.response.headers)) {
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
 * @param {{
 *   name: string,
 *   description: string,
 *   mode: ('schema'|'exact'),
 *   request: Array<*>,
 *   method: string,
 *   parse: boolean,
 *   headers: Record<string, string>,
 *   query: Record<string, string>,
 *   path: string,
 *   response: {}}} test
 * @param {{log: Logger}} opts
 */
const runTest = async function* (test, { log }) {
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
          ...((r.response || { headers: {} }).headers || {}),
        }),
      },
      path: join(test.path, r.path || ''),
      headers: normalizeHeaders({ ...(test.headers), ...r.headers }),
      query: { ...(test.query), ...r.query },
    }, { log });
  }
  log.log('');
};

/**
 * @param {{
 *   method: string,
 *   name: string,
 *   description: string,
 *   parse: boolean,
 *   mode: ('exact'|'schema'),
 *   response: {}, path: string,
 *   headers: Record<string, string>,
 *   tests: Array<*>,
 *   query: Record<string, string>}} suite
 * @param {{log: Logger}} opts
 */
const runSuite = async function* (suite, { log }) {
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
          ...((t.response || { headers: {} }).headers || {}),
        },
      },
      path: endpoint,
      headers: { ...(suite.headers), ...t.headers },
      query: { ...(suite.query), ...t.query },
    }, { log });
  }
};

/**
 * @param {{}} s
 * @param {{log: Logger}} opts
 */
const run = (s, { log }) => runSuite({
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
}, { log });

module.exports = run;
