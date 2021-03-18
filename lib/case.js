const memoize = require('lodash/memoize')
const mapKeys = require('lodash/mapKeys')
const mapValues = require('lodash/mapValues')
const camelCase = require('lodash/camelCase')
const snakeCase = require('lodash/snakeCase')

/**
 * Reserved keywords.
 *
 * @type {String[]}
 */
const keywords = ['*']

/**
 * Case converters.
 *
 * @type {Object}
 */
const converters = {
  none: x => x,
  camelcase: memoize(camelCase),
  snakecase: memoize(snakeCase)
}

/**
 * Case converters types.
 *
 * @type {String[]}
 */
exports.types = Object.keys(converters)

/**
 * Map keys recursively.
 *
 * @param {*} obj
 * @param {Function} mapper
 * @return {*}
 */
function deep (obj, mapper) {
  if (Array.isArray(obj)) {
    return obj.map((v) => deep(v, mapper))
  }

  if (obj instanceof Object) {
    return mapValues(mapKeys(obj, (v, k) => mapper(k)), (v) => deep(v, mapper))
  }

  return obj
}

/**
 * Convert database column names.
 *
 * @param {Object} config
 * @return {Object}
 */
exports.wrap = function (config) {
  const options = Object.assign({}, config)

  delete options.wrapIdentifier
  delete options.postProcessResponse

  const wrapConverter = converters[config.case.database]
  const postConverter = converters[config.case.software]

  const hasWrapFunction = typeof config.wrapIdentifier === 'function'
  const hasPostFunction = typeof config.postProcessResponse === 'function'

  options.wrapIdentifier = function (value, origImpl, queryContext) {
    if (hasWrapFunction) {
      value = config.wrapIdentifier(value, x => x, queryContext)
    }

    if (!keywords.includes(value)) {
      value = wrapConverter(value)
    }

    return origImpl(value)
  }

  options.postProcessResponse = function (result, queryContext) {
    result = deep(result, postConverter)

    if (hasPostFunction) {
      result = config.postProcessResponse(result, queryContext)
    }

    return result
  }

  return options
}
