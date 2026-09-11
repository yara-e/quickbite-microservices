import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE media (
      id BIGSERIAL PRIMARY KEY,
      restaurant_id BIGINT,
      uploaded_by BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      media_url TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_media_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
      CONSTRAINT fk_media_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE INDEX idx_media_restaurant_id ON media(restaurant_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS media;`);
}