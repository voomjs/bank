const Joi = require('joi')
const Knex = require('knex')
const Case = require('./case')

class Plugin {
  /**
   * Plugin package.
   *
   * @return {Object}
   */
  static get package () {
    return require('../package.json')
  }

  /**
   * Plugin registration.
   *
   * @param {...Object} options
   */
  static async register (...options) {
    return new Plugin(...options).register()
  }

  /**
   * Plugin as Object.
   *
   * @return {Object}
   */
  static asObject () {
    return { pkg: this.package, register: this.register }
  }

  /**
   * Create a new Plugin instance.
   *
   * @param {Object} server
   * @param {Object} options
   */
  constructor (server, options) {
    this.server = server
    this.options = Joi.attempt(options, this.schema)
  }

  /**
   * Plugin instance registration.
   */
  async register () {
    this.bank = Knex(Case.wrap(this.options))

    this.server.decorate('server', 'bank', () => this.bank)
    this.server.decorate('request', 'bank', () => this.bank)

    this.server.ext('onPreStart', this.onPreStart, { bind: this })
    this.server.ext('onPostStop', this.onPostStop, { bind: this })
  }

  /**
   * Handle pre-start event.
   *
   * @param {Object} server
   */
  async onPreStart (server) {
    await this.connect(server)
    await this.migrate(server)
  }

  /**
   * Handle post-stop event.
   *
   * @param {Object} server
   */
  async onPostStop (server) {
    await this.destroy(server)
  }

  /**
   * Check database connection.
   *
   * @param {Object} server
   */
  async connect (server) {
    if (this.auto('connect')) {
      await server.bank().raw('SELECT 1')
    }
  }

  /**
   * Run database migrations.
   *
   * @param {Object} server
   */
  async migrate (server) {
    if (this.auto('migrate')) {
      await server.bank().migrate.latest()
    }
  }

  /**
   * Destroy database connection.
   *
   * @param {Object} server
   */
  async destroy (server) {
    if (this.auto('destroy')) {
      await server.bank().destroy()
    }
  }

  /**
   * Determine if the given action should be executed.
   *
   * @param {String} action
   * @return {Boolean}
   */
  auto (action) {
    return this.options.auto[action]
  }

  /**
   * Options schema.
   *
   * @return {Object}
   */
  get schema () {
    return Joi.object().unknown().keys({
      auto: Joi.object().default().keys({
        connect: Joi.boolean().default(true),
        migrate: Joi.boolean().default(false),
        destroy: Joi.boolean().default(true)
      }),
      case: Joi.object().default().keys({
        software: Joi.valid(...Case.types).default('camelcase'),
        database: Joi.valid(...Case.types).default('snakecase')
      })
    })
  }
}

module.exports = Plugin
