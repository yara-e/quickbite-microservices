import "reflect-metadata"
import http from "http"
import { createApp } from "./app"

import { env } from "./lib/config/env"
import { db } from "./lib/knex/knex"


const app = createApp();

const server = http.createServer(app)

server.listen(env.port, () => {
    console.log(`server listening on ${env.port}`)
})

async function shutdown() {
    server.close(async () => {
        console.log("db shutdown")
        await db.destroy();
        process.exit(0)
    })
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);