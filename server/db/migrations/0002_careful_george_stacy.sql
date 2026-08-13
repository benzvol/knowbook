CREATE TABLE `item_subfeeds` (
	`item_id` integer NOT NULL,
	`subfeed_id` integer NOT NULL,
	PRIMARY KEY(`item_id`, `subfeed_id`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subfeed_id`) REFERENCES `subfeeds`(`id`) ON UPDATE no action ON DELETE cascade
);
