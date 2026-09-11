"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
/**
 * Line-item rows. Not partitioned (no time-range queries — always joined
 * by order_id). FK to orders is omitted on purpose: orders is partitioned,
 * so a Postgres FK would need to include the partition key. We own all
 * writes through the order service, so we enforce integrity in code.
 */
async function up(knex) {
    await knex.raw(`
        CREATE TABLE order_items (
            id                  BIGSERIAL PRIMARY KEY,
            region              TEXT NOT NULL,
            order_id            BIGINT NOT NULL,
            product_id          BIGINT NOT NULL,
            quantity            INT NOT NULL CHECK (quantity > 0),
            unit_price_snapshot INT NOT NULL,
            name_snapshot       TEXT NOT NULL,
            image_url_snapshot  TEXT NULL,
            line_total          INT NOT NULL,
            created_at          TIMESTAMP NOT NULL DEFAULT NOW()
        );
    `);
    // supports order detail expansion via whereIn(order_ids)
    await knex.raw(`CREATE INDEX idx_order_items_order_id ON order_items (order_id)`);
}
async function down(knex) {
    await knex.raw(`DROP TABLE IF EXISTS order_items`);
}
