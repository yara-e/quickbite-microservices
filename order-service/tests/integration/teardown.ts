import "reflect-metadata";
import {config} from "dotenv";
import path from "path";

config({path: path.resolve(__dirname, "../../.env.test")});

export default async function teardown(): Promise<void> {
    const {destroyAllShards} = require("../../src/lib/knex/shards");
    await destroyAllShards();
}