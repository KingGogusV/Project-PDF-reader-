import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// A finite primary-key range enforces the account ceiling even if application logic regresses.
// PDF bytes, filenames, passwords and document content never enter this database.
export const accounts = sqliteTable('accounts', {
  slot: integer('slot').primaryKey(),
  userId: text('user_id').notNull(),
  accountId: text('account_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [
  check('account_slot_range', sql`${table.slot} BETWEEN 1 AND 200`),
  uniqueIndex('accounts_user_id_unique').on(table.userId),
  uniqueIndex('accounts_account_id_unique').on(table.accountId),
]);
