CREATE TABLE `accounts` (
	`slot` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "account_slot_range" CHECK("accounts"."slot" BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_id_unique` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_account_id_unique` ON `accounts` (`account_id`);