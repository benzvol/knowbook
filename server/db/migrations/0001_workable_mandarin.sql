DROP TABLE `categories`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`managed` integer DEFAULT false NOT NULL,
	`pagination` text,
	`query_params` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sources`("id", "url", "title", "managed", "pagination", "query_params", "created_at", "updated_at") SELECT "id", "url", "title", "managed", "pagination", "query_params", "created_at", "updated_at" FROM `sources`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
ALTER TABLE `__new_sources` RENAME TO `sources`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `subfeeds` DROP COLUMN `column_param`;