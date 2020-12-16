const Utils = require('./utils')

class Case {
  /**
   * Convert database column names.
   *
   * @param {Object} config
   * @return {Object}
   */
  static wrap (config) {
    const options = Object.assign({}, config)

    delete options.wrapIdentifier
    delete options.postProcessResponse

    const wrapConverter = this.converters[config.case.database]
    const postConverter = this.converters[config.case.software]

    const hasWrapFunction = typeof config.wrapIdentifier === 'function'
    const hasPostFunction = typeof config.postProcessResponse === 'function'

    options.wrapIdentifier = (value, origImpl, queryContext) => {
      if (hasWrapFunction) {
        value = config.wrapIdentifier(value, x => x, queryContext)
      }

      if (!this.keywords.includes(value)) {
        value = wrapConverter(value)
      }

      return origImpl(value)
    }

    options.postProcessResponse = (result, queryContext) => {
      result = this.mapKeys(result, postConverter)

      if (hasPostFunction) {
        result = config.postProcessResponse(result, queryContext)
      }

      return result
    }

    return options
  }

  /**
   * Run a function over each of the keys.
   *
   * @param {Object} obj
   * @param {Function} func
   * @return {Object}
   */
  static mapKeys (obj, func) {
    if (Array.isArray(obj)) {
      return obj.map((v) => this.mapKeys(v, func))
    }

    if (obj instanceof Date) {
      return obj
    }

    if (obj instanceof Object) {
      return Utils.mapValues(Utils.mapKeys(obj, (v, k) => func(k)), (v) => this.mapKeys(v, func))
    }

    return obj
  }

  /**
   * Reserved keywords.
   *
   * @return {String[]}
   */
  static get keywords () {
    return [
      '*'
    ]
  }

  /**
   * Case converters.
   *
   * @return {Object}
   */
  static get converters () {
    return {
      none: x => x,
      camelcase: Utils.memoize(Utils.camelCase),
      snakecase: Utils.memoize(Utils.snakeCase)
    }
  }

  /**
   * Case converters types.
   *
   * @return {String[]}
   */
  static get types () {
    return Object.keys(this.converters)
  }
}

module.exports = Case
