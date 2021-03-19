# @voom/bank

#### SQL client for [Hapi](https://hapi.dev).

This plugin exposes a bank instance within your server.
 
The following operations can be performed automatically:

- Check the database connection on server startup and throw an error if the database is unreachable.
- Run database migrations on server startup.
- Destroy the database connection on server shutdown.

This plugin will also convert the columns case between code and database.

## Installation

```shell script
npm install @voom/bank
```

## Usage

```js
const Hapi = require('@hapi/hapi')
const Bank = require('@voom/bank')

async function start () {
  const server = Hapi.Server()

  await server.register({
    plugin: Bank,
    options: {
      client: 'mysql', // postgres, sqlite3, ...
      connection: {
        // ...
      },
      migrations: {
        // ...
      },
      seeds: {
        // ...
      },
      auto: {
        connect: true,
        migrate: false,
        destroy: true
      },
      case: {
        software: 'camelcase',
        database: 'snakecase'
      }
    }
  })

  await server.start()

  const user = await server.bank() // or request.bank()
    .table('users')
    .where('id', 1)
    .first()
}

start()
```
