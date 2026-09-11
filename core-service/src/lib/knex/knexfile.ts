import { env } from '../config/env.js'
import type { Knex } from 'knex';

const config: Knex.Config = {
   client: "pg",
   connection: {
      host: env.db.host,
      port: env.db.port,
      user: env.db.username,
      database: env.db.name,
      password: env.db.password
   },
   pool: {
      max: env.db.poolMax
   },
   migrations: {
      directory: env.db.migrationDirectory,
      extension: env.db.migrationExtension
   }
}

export default config