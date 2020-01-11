const { join } = require('path');
const { assert } = require('chai');

const rp = require('request-promise-native');

const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });

/**
 * @param {Record<string, string>} headers
 * @return {Record<string, string>}
 */
const normalizeHeaders = headers =>
  Object.fromEntries(
    Object
    .entries(headers)
    .map(([header, value]) => [header.toLocaleLowerCase(), value]));

/**
 * @param {{name: string, path: string, description: string}} suite
 */
const logSuite = ({ name, path, description }) => {
  console.log(`Test Suite :: ${name ? name + ' ' : ''}${path}\n`);
  if (description) {
    console.log(description);
  }
};

/**
 * @param {{name: string, description: string}} test
 */
const logTest = ({ name, description }) => {
  console.log(name);
  if (description) {
    console.log(description);
  }
};

/**
 * @param {{query: Record<string, string>, headers: Record<string, string>, method: string, path: string, description: string}} request
 */
const logRequest = ({ headers, query, method, path, description }) => {
  const queryJoined = Object.entries(query).map(pair => pair.join('=')).join('&');
  const q = Object.entries(query).length === 0 ? '' : '?';
  console.log(`\n${method.toUpperCase()} ${path}${q}${queryJoined}\n`);
  if (description) {
    console.log(description);
  }
  console.log(headers);
  console.log('');
};

/**
 * @param {{statusMessage: string, statusCode: number, body: *, headers: Record<string, string>}} response
 */
const logResponse = ({ headers, body, statusCode, statusMessage }) => {
  console.log(`\n${statusMessage.toUpperCase()} ${statusCode}\n`);
  console.log(headers);
  console.log('');
  console.log(body);
};

const runner = async (s) => {
  const suite = {
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
      ...(s.response || {}),
      headers: { ...((s.response || { headers: {} }).headers || {}) },
    },
  };
  logSuite(suite);
  let tIdx = 0;
  for (const t of suite.tests) {
    const test = {
      name: `Test Case #${tIdx} :: ${join(suite.path, t.path)}`,
      method: suite.method,
      parse: suite.parse,
      mode: suite.mode,
      description: '',
      ...t,
      response: {
        status: suite.response.status,
        ...(t.response || {}),
        ...suite.response,
        headers: {
          ...suite.response.headers,
          ...((t.response || { headers: {} }).headers || {}),
        },
      },
      path: join(suite.path, t.path),
      headers: {...suite.headers, ...t.headers},
      query: {...suite.query, ...t.query},
    };
    console.group();
    logTest(test);
    test.request = Array.isArray(test.request) ? test.request : [test.request];
    let rIdx = 0;
    for (const rq of test.request) {
      console.group();
      const request = {
        name: `request #${rIdx}`,
        method: test.method,
        mode: test.mode,
        parse: test.parse,
        description: '',
        ...rq,
        response: {
          status: test.response.status,
          ...(rq.response || {}),
          ...test.response,
          headers: normalizeHeaders({
            ...test.response.headers,
            ...((rq.response || { headers: {} }).headers || {}),
          }),
        },
        path: join(test.path, rq.path),
        headers: normalizeHeaders({...test.headers, ...rq.headers}),
        query: {...test.query, ...rq.query},
      };
      logRequest(request);
      console.time('took');
      const res = await rp({
        uri: `https://${request.path}`,
        method: request.method,
        headers: request.headers,
        qs: request.query,
        body: request.body,
        json: request.parse,
        resolveWithFullResponse: true,
      });
      console.timeEnd('took');
      res.headers = normalizeHeaders(res.headers);
      logResponse(res);
      assert.equal(res.statusCode, request.response.status);
      for (const k in request.response.headers) {
        assert.equal(!!res.headers[k], true);
        assert.equal(res.headers[k], request.response.headers[k]);
      }
      if (request.mode === 'exact') {
        assert.deepEqual(res.body, request.response.body);
      } else if (request.mode === 'schema') {
        const validate = ajv.compile(request.response.body);
        const valid = validate(res.body);
        if (!valid) {
          throw new Error(`schema validation failed ${validate.errors.map(e => e.message).join(', ')}`);
        }
      } else {
        throw new Error(`mode ${request.mode} not implemented yet`);
      }
      console.groupEnd();
      rIdx++;
    }
    console.groupEnd();
    tIdx++;
  }
};

module.exports = runner;
