import { db } from "@/lib/knex/knex";
import { Media } from "../entity/media.entity";

const MEDIA_COLUMNS = ["id", "restaurant_id", "uploaded_by", "status", "media_url", "created_at"];

export function toEntity(row: any): Media {
  return new Media({
    id: Number(row.id),
    restaurantId: row.restaurant_id ? Number(row.restaurant_id) : null,
    uploadedBy: Number(row.uploaded_by),
    status: row.status,
    mediaUrl: row.media_url,
    createdAt: row.created_at,
  });
}

export async function createMedia(data: Partial<Media>): Promise<Media> {
  const [row] = await db("media")
    .insert({
      restaurant_id: data.restaurantId,
      uploaded_by: data.uploadedBy,
      status: data.status,
      media_url: data.mediaUrl,
    })
    .returning(MEDIA_COLUMNS);

  return toEntity(row);
}

export async function findMediaById(id: number): Promise<Media | undefined> {
  const row = await db("media").select(MEDIA_COLUMNS).where("id", id).first();
  return row ? toEntity(row) : undefined;
}

export async function updateMediaStatus(id: number, status: string): Promise<Media> {
  const [row] = await db("media")
    .where("id", id)
    .update({ status })
    .returning(MEDIA_COLUMNS);

  return toEntity(row);
}