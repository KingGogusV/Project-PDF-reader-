export const MAX_ACCOUNTS = 200;
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface AccountDatabase { prepare(sql: string): Statement }
export interface Identity { userId: string; displayName: string }
export interface Account { accountId: string; createdAt: number }

/** Sites dispatch strips client-supplied identity headers and supplies authenticated identity.
 * This Worker must remain behind that dispatch boundary; never expose a direct public Worker route.
 */
export function getIdentity(request: Request): Identity | null {
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!userId || !email || userId.length > 512 || email.length > 512) return null;
  let name = email;
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(request.headers.get('oai-authenticated-user-full-name') || '') || email; } catch { /* Optional display value. */ }
  }
  return { userId, displayName: name.slice(0, 200) };
}

export async function findAccount(db: AccountDatabase, userId: string): Promise<Account | null> {
  return db.prepare('SELECT account_id AS accountId, created_at AS createdAt FROM accounts WHERE user_id = ?').bind(userId).first<Account>();
}
export async function countAccounts(db: AccountDatabase): Promise<number> {
  return (await db.prepare('SELECT count(*) AS total FROM accounts').first<{ total: number }>())?.total ?? 0;
}

export async function registerAccount(db: AccountDatabase, userId: string): Promise<Account | null> {
  // Allocation and insertion happen in ONE SQLite statement, not a check-then-write race.
  // PK + CHECK independently prevent more than 200 accounts, including concurrent requests.
  await db.prepare(`WITH RECURSIVE slots(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM slots WHERE n < 200)
    INSERT INTO accounts(slot, user_id, account_id, created_at)
    SELECT n, ?, ?, ? FROM slots
    WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE slot = n)
      AND NOT EXISTS (SELECT 1 FROM accounts WHERE user_id = ?)
    ORDER BY n LIMIT 1
    ON CONFLICT(user_id) DO NOTHING`).bind(userId, crypto.randomUUID(), Date.now(), userId).run();
  return findAccount(db, userId);
}
