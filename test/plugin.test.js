require('dotenv/config')

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const Hapi = require('@hapi/hapi')
const Hoek = require('@hapi/hoek')

const Plugin = require('../lib')

const { expect } = Code
const { describe, it } = exports.lab = Lab.script()

const defaults = {
  client: 'mysql',
  connection: {
    host: process.env.BANK_HOST,
    port: process.env.BANK_PORT,
    user: process.env.BANK_USER,
    password: process.env.BANK_PASSWORD,
    database: process.env.BANK_DATABASE
  },
  migrations: {
    directory: './test/migrations'
  }
}

async function withServer (options = {}) {
  const server = Hapi.Server()

  await server.register({
    plugin: Plugin,
    options: Hoek.applyToDefaults(defaults, options)
  })

  return server
}

describe('plugin', function () {
  it('throws an error when options are missing', async function () {
    const server = Hapi.Server()

    await expect(server.register(Plugin)).to.reject()
  })

  it('exposes bank instance', async function () {
    const server = await withServer()

    expect(server.bank).to.be.a.function()

    server.route({
      method: 'GET',
      path: '/plugin',
      handler (request, h) {
        expect(request.bank).to.be.a.function()
        expect(request.bank()).to.be.equal(server.bank())

        return h.response().code(200)
      }
    })

    const res = await server.inject('/plugin')

    expect(res.statusCode).to.be.equal(200)
  })

  describe('connection', function () {
    it('does check connection by default', async function () {
      const server = await withServer({
        connection: {
          user: 'spri'
        }
      })

      await expect(server.initialize()).to.reject()
    })

    it('does check connection when auto.connect is true', async function () {
      const server = await withServer({
        connection: {
          user: 'spri'
        },
        auto: {
          connect: true
        }
      })

      await expect(server.initialize()).to.reject()
    })

    it('does not check connection when auto.connect is false', async function () {
      const server = await withServer({
        connection: {
          user: 'spri'
        },
        auto: {
          connect: false
        }
      })

      await expect(server.initialize()).to.not.reject()
    })
  })

  describe('migrations', function () {
    it('does not run migrations by default', async function () {
      const server = await withServer()

      const versionPre = await server.bank().migrate.currentVersion()

      expect(versionPre).to.be.equal('none')

      await server.initialize()

      const versionPost = await server.bank().migrate.currentVersion()

      expect(versionPost).to.be.equal('none')

      await server.bank().migrate.rollback({}, true)
    })

    it('does run migrations when auto.migrate is true', async function () {
      const server = await withServer({ auto: { migrate: true } })

      const versionPre = await server.bank().migrate.currentVersion()

      expect(versionPre).to.be.equal('none')

      await server.initialize()

      const versionPost = await server.bank().migrate.currentVersion()

      expect(versionPost).to.be.equal('basic.js')

      await server.bank().migrate.rollback({}, true)
    })

    it('does not run migrations when auto.migrate is false', async function () {
      const server = await withServer({ auto: { migrate: false } })

      const versionPre = await server.bank().migrate.currentVersion()

      expect(versionPre).to.be.equal('none')

      await server.initialize()

      const versionPost = await server.bank().migrate.currentVersion()

      expect(versionPost).to.be.equal('none')

      await server.bank().migrate.rollback({}, true)
    })
  })

  describe('destruction', function () {
    it('does destroy connection by default', async function () {
      const server = await withServer()

      await server.initialize()

      server.ext('onPreStop', function () {
        expect(server.bank()).to.exist()
      })

      server.ext('onPostStop', async function () {
        await expect(server.bank().raw('SELECT 1')).to.reject()
      })

      await server.stop()
    })

    it('does destroy connection when auto.destroy is true', async function () {
      const server = await withServer({ auto: { destroy: true } })

      await server.initialize()

      server.ext('onPreStop', function () {
        expect(server.bank()).to.exist()
      })

      server.ext('onPostStop', async function () {
        await expect(server.bank().raw('SELECT 1')).to.reject()
      })

      await server.stop()
    })

    it('does not destroy connection when auto.destroy is false', async function () {
      const server = await withServer({ auto: { destroy: false } })

      await server.initialize()

      server.ext('onPreStop', function () {
        expect(server.bank()).to.exist()
      })

      server.ext('onPostStop', async function () {
        await expect(server.bank().raw('SELECT 1')).to.not.reject()
      })

      await server.stop()
    })
  })

  describe('case conversion', function () {
    const noop = x => x

    const keys = [
      {
        any: '*',
        camel: '*',
        snake: '*'
      },
      {
        any: 'TEST',
        camel: 'test',
        snake: 'test'
      },
      {
        any: 'test-key',
        camel: 'testKey',
        snake: 'test_key'
      },
      {
        any: 'TestSecondKey',
        camel: 'testSecondKey',
        snake: 'test_second_key'
      }
    ]

    const anyCaseObject = {
      TestTypes: {
        TestNull: null,
        TestNumber: 1234,
        TestBoolean: true
      },
      test_nested: {
        test_nested_one: {
          test_any: 'hello'
        },
        test_nested_two: {
          test_any: 'world'
        }
      },
      'TEST-ARRAYS': [
        { 'TEST-ANY': 'hello' },
        { 'TEST-ANY': 'world' }
      ]
    }

    const camelCaseObject = {
      testTypes: {
        testNull: null,
        testNumber: 1234,
        testBoolean: true
      },
      testNested: {
        testNestedOne: {
          testAny: 'hello'
        },
        testNestedTwo: {
          testAny: 'world'
        }
      },
      testArrays: [
        { testAny: 'hello' },
        { testAny: 'world' }
      ]
    }

    const snakeCaseObject = {
      test_types: {
        test_null: null,
        test_number: 1234,
        test_boolean: true
      },
      test_nested: {
        test_nested_one: {
          test_any: 'hello'
        },
        test_nested_two: {
          test_any: 'world'
        }
      },
      test_arrays: [
        { test_any: 'hello' },
        { test_any: 'world' }
      ]
    }

    it('uses camelcase in software by default', async function () {
      const server = await withServer()

      const { client: { config } } = server.bank()

      const post = config.postProcessResponse

      expect(post(anyCaseObject)).to.be.equal(camelCaseObject)
      expect(post(snakeCaseObject)).to.be.equal(camelCaseObject)
    })

    it('uses snakecase in database by default', async function () {
      const server = await withServer()

      const { client: { config } } = server.bank()

      const wrap = config.wrapIdentifier

      for (const key of keys) {
        expect(wrap(key.any, noop)).to.be.equal(key.snake)
        expect(wrap(key.camel, noop)).to.be.equal(key.snake)
      }
    })

    it('does not change case in software when case is none', async function () {
      const server = await withServer({
        case: {
          software: 'none'
        }
      })

      const { client: { config } } = server.bank()

      const post = config.postProcessResponse

      expect(post(anyCaseObject)).to.be.equal(anyCaseObject)
      expect(post(camelCaseObject)).to.be.equal(camelCaseObject)
      expect(post(snakeCaseObject)).to.be.equal(snakeCaseObject)
    })

    it('does not change case in database when case is none', async function () {
      const server = await withServer({
        case: {
          database: 'none'
        }
      })

      const { client: { config } } = server.bank()

      const wrap = config.wrapIdentifier

      for (const key of keys) {
        expect(wrap(key.any, noop)).to.be.equal(key.any)
        expect(wrap(key.camel, noop)).to.be.equal(key.camel)
        expect(wrap(key.snake, noop)).to.be.equal(key.snake)
      }
    })

    it('extends existing hooks', async function () {
      const server = await withServer({
        wrapIdentifier (value) {
          expect(value).to.be.equal('testKey')

          return value
        },
        postProcessResponse (value) {
          expect(value).to.be.equal({ testKey: 'value' })

          return value
        }
      })

      const { client: { config } } = server.bank()

      const wrap = config.wrapIdentifier
      const post = config.postProcessResponse

      expect(wrap('testKey', noop)).to.be.equal('test_key')
      expect(post({ test_key: 'value' })).to.be.equal({ testKey: 'value' })
    })
  })
})
