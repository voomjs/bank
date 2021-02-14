require('dotenv/config')

const Sinon = require('sinon')
const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const Hapi = require('@hapi/hapi')

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

async function withServer (options) {
  const server = Hapi.Server()

  await server.register({
    plugin: Plugin,
    options: Object.assign({}, defaults, options)
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
      const server = await withServer()

      Sinon.stub(server.bank(), 'raw').callsFake(function () {
        throw new Error('Database connection failed')
      })

      try {
        await server.initialize()

        Code.fail()
      } catch (e) {
        expect(e.message).to.be.equal('Database connection failed')
      }
    })

    it('does check connection when auto.connect is true', async function () {
      const server = await withServer({ auto: { connect: true } })

      Sinon.stub(server.bank(), 'raw').callsFake(function () {
        throw new Error('Database connection failed')
      })

      try {
        await server.initialize()

        Code.fail()
      } catch (e) {
        expect(e.message).to.be.equal('Database connection failed')
      }
    })

    it('does not check connection when auto.connect is false', async function () {
      const server = await withServer({ auto: { connect: false } })

      Sinon.stub(server.bank(), 'raw').callsFake(function () {
        throw new Error('Database connection failed')
      })

      await server.initialize()
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

      server.ext('onPreStop', function () {
        expect(server.bank()).to.exist()
      })

      const spy = Sinon.spy(server.bank(), 'destroy')

      await server.initialize()

      expect(spy.callCount).to.be.equal(0)

      await server.stop()

      expect(spy.callCount).to.be.equal(1)
    })

    it('does destroy connection when auto.destroy is true', async function () {
      const server = await withServer({ auto: { destroy: true } })

      server.ext('onPreStop', function () {
        expect(server.bank()).to.exist()
      })

      const spy = Sinon.spy(server.bank(), 'destroy')

      await server.initialize()

      expect(spy.callCount).to.be.equal(0)

      await server.stop()

      expect(spy.callCount).to.be.equal(1)
    })

    it('does not destroy connection when auto.destroy is false', async function () {
      const server = await withServer({ auto: { destroy: false } })

      server.ext('onPreStop', function () {
        expect(server.bank()).to.exist()
      })

      const spy = Sinon.spy(server.bank(), 'destroy')

      await server.initialize()

      expect(spy.callCount).to.be.equal(0)

      await server.stop()

      expect(spy.callCount).to.be.equal(0)
    })
  })

  describe('case conversion', function () {
    const noop = x => x
    const date = new Date()

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
        TestBoolean: true,
        testDate: date
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
        testBoolean: true,
        testDate: date
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
        test_boolean: true,
        test_date: date
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

      expect(config).to.be.an.object()
      expect(config.wrapIdentifier).to.be.a.function()
      expect(config.postProcessResponse).to.be.a.function()

      const post = config.postProcessResponse

      expect(post(anyCaseObject)).to.be.equal(camelCaseObject)
      expect(post(snakeCaseObject)).to.be.equal(camelCaseObject)
    })

    it('uses snakecase in database by default', async function () {
      const server = await withServer()

      const { client: { config } } = server.bank()

      expect(config).to.be.an.object()
      expect(config.wrapIdentifier).to.be.a.function()
      expect(config.postProcessResponse).to.be.a.function()

      const wrap = config.wrapIdentifier

      for (const key of keys) {
        expect(wrap(key.any, noop)).to.be.equal(key.snake)
        expect(wrap(key.camel, noop)).to.be.equal(key.snake)
      }
    })

    it('does not change string case when case is none', async function () {
      const server = await withServer({
        case: {
          software: 'none',
          database: 'none'
        }
      })

      const { client: { config } } = server.bank()

      const wrap = config.wrapIdentifier
      const post = config.postProcessResponse

      expect(post(anyCaseObject)).to.be.equal(anyCaseObject)

      for (const key of keys) {
        expect(wrap(key.any, noop)).to.be.equal(key.any)
      }
    })

    it('extends existing hooks and uses case.software', async function () {
      const server = await withServer({
        wrapIdentifier (value, origImpl) {
          expect(value).to.be.equal('testKey')

          return origImpl(value + 'Wrap')
        },
        postProcessResponse (result) {
          expect(result).to.be.equal({ testKey: 'value' })

          return Object.assign(result, { otherKey: 'other' })
        }
      })

      const { client: { config } } = server.bank()

      const wrap = config.wrapIdentifier
      const post = config.postProcessResponse

      expect(wrap('testKey', noop)).to.be.equal('test_key_wrap')
      expect(post({ test_key: 'value' })).to.be.equal({ testKey: 'value', otherKey: 'other' })
    })
  })
})
