CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"last_digest_day" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
