ALTER TABLE `sources` ADD `last_visited_at` integer;
--> statement-breakpoint
ALTER TABLE `subfeeds` ADD `last_visited_at` integer;
--> statement-breakpoint
ALTER TABLE `feeds` ADD `last_visited_at` integer;
