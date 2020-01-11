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
 * @param {boolean} silent
 */
const logSuite = ({name, path, description}, silent) => {
  if (name) {
    console.log(cyan(`Test Suite :: ${name} ${path}\n`));
  } else {
    console.log(cyan(`Test Suite :: ${path}\n`));
  }
  if (description && !silent) {
    console.log(description);
  }
};

/**
 * @param {{name: string, description: string}} test
 * @param {boolean} silent
 */
const logTest = ({name, description}, silent) => {
  console.log(magenta(name));
  if (description && !silent) {
    console.log(description);
  }
};

/**
 * @param {{query: Record<string, string>, headers: Record<string, string>, method: string, path: string, description: string}} request
 * @param {boolean} silent
 */
const logRequest = ({headers, query, method, path, description}, silent) => {
  console.log('');
  if (silent || Object.keys(query).length === 0) {
    console.log(yellow(`${method.toUpperCase()} ${path}`));
  } else {
    const queryJoined = Object.entries(query).
      map(pair => pair.join('=')).
      join('&');
    console.log(yellow(`${method.toUpperCase()} ${path}?${queryJoined}`));
  }
  console.log('');
  if (silent) {
    return;
  }
  if (description) {
    console.log(description);
  }
  console.log(fmtHeaders(headers));
  console.log('');
};

/**
 * @param {{statusMessage: string, statusCode: number, body: *, headers: Record<string, string>}} response
 * @param {boolean} silent
 */
const logResponse = ({headers, body, statusCode, statusMessage}, silent) => {
  console.log(green(`\n${statusMessage.toUpperCase()} ${statusCode}\n`));
  if (!silent) {
    console.log(fmtHeaders(headers));
    console.log('');
    console.log(body);
    console.log('');
  }
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
 * @param {{silent: boolean}} opts
 * @return {Promise<void>}
 */
const runRequest = async (request, {silent}) => {
  console.group();
  logRequest(request, silent);
  console.time('took');
  const res = await rp({
    uri: `https://${(request.path)}`,
    method: request.method,
    headers: request.headers,
    qs: request.query,
    body: request.body,
    json: request.parse,
    resolveWithFullResponse: true,
  });
  console.timeEnd('took');
  res.headers = normalizeHeaders(res.headers);
  logResponse(res, silent);
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
  console.log(green('[PASS]'));
  console.groupEnd();
};

/**
 * @param {{name: string, description: string, mode: ('schema'|'exact'), request: {}[], method: string, parse: boolean, headers: Record<string, string>, query: Record<string, string>, path: string, response: {}}} test
 * @param {{silent: boolean}} opts
 */
const runTest = async function* (test, {silent}) {
  console.group();
  logTest(test, silent);
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
    }, {silent});
  }
  console.log('');
  console.groupEnd();
};

/**
 * @param {{method: string, name: string, description: string, parse: boolean, mode: ('exact'|'schema'), response: {}, path: string, headers: Record<string, string>, tests: {}[], query: Record<string, string>}} suite
 * @param {{silent: boolean}} opts
 */
const runSuite = async function* (suite, {silent}) {
  logSuite(suite, silent);
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
    }, {silent});
  }
};

/**
 * @param {{}} s
 * @param {{silent: boolean}} opts
 */
const run = (s, {silent}) => runSuite({
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
}, {silent});

module.exports = run;
