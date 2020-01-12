/**
 * @param {Record<string, string>} headers
 * @return {Record<string, string>}
 */
const normalizeHeaders = (headers) => {
  /**
   * @param {string[]} pair
   * @return {string[]}
   */
  const fn = ([header, value]) => [header.toLocaleLowerCase(), value];
  return Object.fromEntries(Object.entries(headers).map(fn));
};

/**
 * @param {Record<string, string>} headers
 */
const fmtHeaders = (headers) => {
  const padding = Object.keys(headers)
    .map((k) => k.length)
    .reduce((x, y) => Math.max(x, y));
  /**
   * @param {string[]} pair
   * @return {string}
   */
  const fn = ([header, value]) => `${header.padEnd(
    padding,
  )} ${value.toString()}`;
  return Object.entries(headers).map(fn).join('\n');
};

/**
 * @param {{errors: Array<Record<string, *>>}} validate
 * @return {string}
 */
const getSchemaErrMsg = (validate) => validate.errors.map((e) => [
  e.message,
  e.data,
  e.dataPath,
  e.keyword,
  e.propertyName,
  e.schemaPath,
].map((info) => info || '')
  .filter(Boolean)
  .map((info) => info.toString())
  .join(', ')).join(', ');

module.exports = {
  normalizeHeaders,
  fmtHeaders,
  getSchemaErrMsg,
};
