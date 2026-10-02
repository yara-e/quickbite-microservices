
import { z } from 'zod';
import path from "node:path"; // or import * as path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../.env") });

const schema = z.object({
    PORT: z.string().default("3000"),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.string().default("5432"),
    DB_USERNAME: z.string().default("postgres"),
    DB_PASSWORD: z.string(),
    DB_NAME: z.string(),
    DB_POOL_MAX: z.string().default('10'),
    DB_MIGRATION_DIRECTORY: z.string(),
    DB_MIGRATION_EXTENSION: z.string(),
    ACCESS_SECRET: z.string(),
    REFRESH_SECRET: z.string(),
    ACCESS_EXPIRES_IN: z.string(),
    REFRESH_EXPIRES_IN: z.string(),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379'),
    REDIS_PASSWORD: z.string().default(""),
    MAILJET_API_KEY: z.string(),
    MAILJET_SECRET_KEY: z.string(),
    MAILJET_FROM_EMAIL: z.string(),
    MAILJET_FROM_NAME: z.string(),
    INTERNAL_API_KEY: z.string().default(""),

    RABBITMQ_URL: z.string().default("amqp://guest:guest@localhost:5672"),
    RABBITMQ_CORE_EVENTS_EXCHANGE: z.string().default("core.events"),
    // Cron expression for the outbox drain schedule. 6-field form; "* * * * * *" = every second.
    OUTBOX_DRAIN_CRON: z.string().default("* * * * * *"),
    OUTBOX_BATCH_SIZE: z.string().default("50"),

    // Cloudflare R2 Storage (S3-compatible)
    R2_ACCESS_KEY_ID: z.string(),
    R2_SECRET_ACCESS_KEY: z.string(),
    R2_BUCKET_NAME: z.string(),
    R2_ENDPOINT: z.string(),
    R2_PUBLIC_URL: z.string(),


    AWS_S3_BUCKET_NAME: z.string(),
    AWS_REGION: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    // Optional: Only used if serving files via CloudFront CDN or a custom domain
    AWS_S3_PUBLIC_URL: z.string(),


});

const parsed = schema.parse(process.env);

export const env = {
    port: Number(parsed.PORT),
    db: {
        host: parsed.DB_HOST,
        port: Number(parsed.DB_PORT),
        username: parsed.DB_USERNAME,
        password: parsed.DB_PASSWORD,
        name: parsed.DB_NAME,
        poolMax: Number(parsed.DB_POOL_MAX),
        migrationDirectory: path.resolve(__dirname, "../../../", parsed.DB_MIGRATION_DIRECTORY),
        migrationExtension: parsed.DB_MIGRATION_EXTENSION,
    },
    jwt: {
        refreshSecret: parsed.REFRESH_SECRET,
        accessSecret: parsed.ACCESS_SECRET,
        accessExpiresIn: parsed.ACCESS_EXPIRES_IN,
        refreshExpiresIn: parsed.REFRESH_EXPIRES_IN,
    },
    isProduction: process.env.NODE_ENV === "production",
    cors: {
        origins: parsed.CORS_ORIGINS.split(','),
    },
    // redis
    redis: {
        host: parsed.REDIS_HOST,
        port: Number(parsed.REDIS_PORT),
        password: parsed.REDIS_PASSWORD,
    },
    mailjet: {
        apiKey: parsed.MAILJET_API_KEY,
        secretKey: parsed.MAILJET_SECRET_KEY,
        fromEmail: parsed.MAILJET_FROM_EMAIL,
        fromName: parsed.MAILJET_FROM_NAME,
    },
    internal: {
        apiKey: parsed.INTERNAL_API_KEY,
    },
    rabbit: {
        url: parsed.RABBITMQ_URL,
        exchange: parsed.RABBITMQ_CORE_EVENTS_EXCHANGE,
        drainCron: parsed.OUTBOX_DRAIN_CRON,
        batchSize: Number(parsed.OUTBOX_BATCH_SIZE),
    },
    // r2 storage
    r2: {
        accessKeyId: parsed.R2_ACCESS_KEY_ID,
        secretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
        bucketName: parsed.R2_BUCKET_NAME,
        endpoint: parsed.R2_ENDPOINT,
        publicUrl: parsed.R2_PUBLIC_URL,
    },
    s3: {
        bucketName: process.env.AWS_S3_BUCKET_NAME || "",
        region: process.env.AWS_REGION || "us-east-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        // Optional: Only used if serving files via CloudFront CDN or a custom domain
        publicUrl: process.env.AWS_S3_PUBLIC_URL || "",
    }
};