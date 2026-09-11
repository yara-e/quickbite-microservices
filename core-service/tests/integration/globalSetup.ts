import 'reflect-metadata'
import { config } from 'dotenv'
import path from 'path'

config({path: path.resolve(__dirname, '../../.env.test') })

const WGS84_SRID_4326 = {
    srid: 4326,
    auth_name: 'EPSG',
    auth_srid: 4326,
    srtext: 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
    proj4text: '+proj=longlat +datum=WGS84 +no_defs ',
};

export default async function globalSetup() {
    const {db} = require("../../src/lib/knex/knex")
    await db.migrate.latest();
    await ensurePostgisSrid4326(db);
}

/**
 * Some PostGIS installs (notably certain Windows bundles) create the
 * extension without populating `spatial_ref_sys`. The branch "nearby"
 * query depends on SRID 4326, so make sure the WGS84 row exists.
 */
async function ensurePostgisSrid4326(db: any): Promise<void> {
    try {
        const existing = await db("spatial_ref_sys").where({srid: 4326}).first();
        if (existing) return;
        await db("spatial_ref_sys").insert(WGS84_SRID_4326);
    } catch {
        // spatial_ref_sys may not exist if PostGIS isn't available — skip.
    }
}