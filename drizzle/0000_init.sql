CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"day" date NOT NULL,
	"subject" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"price" integer NOT NULL,
	"regular_price" integer,
	"in_stock" boolean NOT NULL,
	"method" text NOT NULL,
	"score" real NOT NULL,
	"conc_assumed" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rejected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"url" text NOT NULL,
	"image" text,
	"price" integer NOT NULL,
	"regular_price" integer,
	"on_sale" boolean DEFAULT false NOT NULL,
	"stock_qty" integer,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand" text,
	"ml" real,
	"conc" text,
	"tester" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ignored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"found" integer DEFAULT 0 NOT NULL,
	"matched" integer DEFAULT 0 NOT NULL,
	"message" text
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"day" date NOT NULL,
	"product_id" integer NOT NULL,
	"libero_price" integer NOT NULL,
	"min_price" integer,
	"min_source" text,
	"gap" integer,
	"verdict" text NOT NULL,
	"prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_day_product_id_pk" PRIMARY KEY("day","product_id")
);
--> statement-breakpoint
CREATE INDEX "email_log_kind_day_idx" ON "email_log" USING btree ("kind","day");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_product_source_external_idx" ON "offers" USING btree ("product_id","source","external_id");--> statement-breakpoint
CREATE INDEX "offers_product_idx" ON "offers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_active_idx" ON "products" USING btree ("active");--> statement-breakpoint
CREATE INDEX "scrape_runs_source_started_idx" ON "scrape_runs" USING btree ("source","started_at");--> statement-breakpoint
CREATE INDEX "snapshots_product_idx" ON "snapshots" USING btree ("product_id");