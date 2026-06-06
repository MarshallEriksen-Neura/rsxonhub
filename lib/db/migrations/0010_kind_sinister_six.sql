ALTER TABLE "ai_configs" ADD COLUMN "chat_api_mode" text DEFAULT 'chat_completions';
--> statement-breakpoint
UPDATE "ai_configs"
SET "chat_api_mode" = 'chat_completions'
WHERE "kind" = 'chat' AND "chat_api_mode" IS NULL;
