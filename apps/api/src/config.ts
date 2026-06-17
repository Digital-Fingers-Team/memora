import { config as loadDotenv } from "dotenv";
import path from "path";
import { z } from "zod";

loadDotenv({ path: path.resolve(__dirname, "../../../.env") });
loadDotenv({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/memora"),
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-me"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  FIRST_ADMIN_EMAIL: z.string().email().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_DEFAULT_MODEL: z.string().default("openai/gpt-4.1-mini"),
  EMBEDDING_PROVIDER: z.string().default("openrouter"),
  EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536)
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
