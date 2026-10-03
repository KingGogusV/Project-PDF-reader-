export interface AccountState {
  identity: { displayName: string } | null;
  account: { accountId: string; createdAt: number } | null;
  registered: number;
  limit: number;
}
export const signInPath = '/signin-with-chatgpt?return_to=%2F%3Faccount%3Dcreate';
export const signOutPath = '/signout-with-chatgpt?return_to=%2F';
export async function getAccount(create = false): Promise<AccountState> {
  const response = await fetch('/api/account', { method: create ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(create ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}), signal: AbortSignal.timeout(12000) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Accounts are available on the hosted website. Local reading remains available.');
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(typeof data?.error === 'string' ? data.error : 'Accounts are unavailable. Try again later.');
    if (response.status >= 500) error.name = 'AccountServiceUnavailableError';
    throw error;
  }
  const validAccount = data?.account === null || (typeof data?.account?.accountId === 'string'
    && data.account.accountId.length > 0 && data.account.accountId.length <= 256 && Number.isFinite(data.account.createdAt));
  const validIdentity = data?.identity === null || (typeof data?.identity?.displayName === 'string' && data.identity.displayName.length <= 200);
  if (data?.limit !== 200 || !Number.isInteger(data?.registered) || data.registered < 0 || data.registered > 200
    || !validAccount || !validIdentity || (data.account !== null && data.identity === null))
    throw new Error('Unexpected account response. No local files were changed.');
  return data as AccountState;
}
