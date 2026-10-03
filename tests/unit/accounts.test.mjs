import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { registerAccount, countAccounts } from '../../server/accounts.ts';
import worker from '../../server/index.ts';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
  const db = { prepare(sql) { let values=[]; return { bind(...args) { values=args; return this; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async run() { return sqlite.prepare(sql).run(...values); } }; } };
  return { db, sqlite };
}
function request(method = 'GET', options = {}) {
  return new Request('https://folio.example/api/account', { method, headers: {
    ...(options.identity === false ? {} : { 'oai-authenticated-user-id': options.user || 'synthetic-user', 'oai-authenticated-user-email': 'test@example.invalid' }),
    ...(method === 'POST' ? { Origin: options.origin || 'https://folio.example', 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  }, ...(method === 'POST' ? { body: options.body || '{}' } : {}) });
}
test('atomic registration caps 220 concurrent callers at exactly 200 accounts', async () => {
  const {db,sqlite}=database();
  try {
    const results=await Promise.all(Array.from({length:220},(_,i)=>registerAccount(db,'user-'+i)));
    assert.equal(results.filter(Boolean).length,200); assert.equal(await countAccounts(db),200);
    assert.equal(new Set(results.filter(Boolean).map(a=>a.accountId)).size,200);
    assert.throws(()=>sqlite.prepare('INSERT INTO accounts VALUES (201,?,?,?)').run('extra','id',1),/CHECK/);
    const existing=await registerAccount(db,'user-0'); assert.equal(existing.accountId,results[0].accountId);
    assert.equal(await countAccounts(db),200);
  } finally { sqlite.close(); }
});
test('duplicate concurrent registrations allocate only one account for an identity',async()=>{
  const{db,sqlite}=database();try{const results=await Promise.all(Array.from({length:25},()=>registerAccount(db,'same-user')));assert.equal(await countAccounts(db),1);assert.equal(new Set(results.map(x=>x.accountId)).size,1);}finally{sqlite.close();}
});
test('API requires authenticated identity and same-origin JSON; no client user ID is trusted',async()=>{
  const{db,sqlite}=database();const env={DB:db};try{
    assert.equal((await worker.fetch(request('POST',{identity:false}),env)).status,401);
    assert.equal((await worker.fetch(request('POST',{origin:'https://evil.example'}),env)).status,403);
    assert.equal((await worker.fetch(request('POST',{headers:{'Content-Type':'text/plain'}}),env)).status,415);
    assert.equal((await worker.fetch(request('POST',{body:'x'.repeat(1025)}),env)).status,413);
    assert.equal(await countAccounts(db),0);
    const response=await worker.fetch(request('POST',{body:JSON.stringify({userId:'victim',accountId:'attacker-chosen'})}),env);
    assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
    const data=await response.json();assert.notEqual(data.account.accountId,'attacker-chosen');
    const row=sqlite.prepare('SELECT * FROM accounts').get();assert.equal(row.user_id,'synthetic-user');
    assert.deepEqual(Object.keys(row).sort(),['account_id','created_at','slot','user_id']);
  }finally{sqlite.close();}
});
test('anonymous status discloses capacity but never another account; cap and outages are explicit',async()=>{
  const{db,sqlite}=database();try{
    for(let i=0;i<200;i++)await registerAccount(db,'full-'+i);
    const anonymous=await(await worker.fetch(request('GET',{identity:false}),{DB:db})).json();
    assert.equal(anonymous.account,null);assert.equal(anonymous.identity,null);assert.equal(anonymous.registered,200);assert.equal(anonymous.limit,200);
    const full=await worker.fetch(request('POST'),{DB:db});assert.equal(full.status,409);assert.equal((await full.json()).code,'ACCOUNT_LIMIT');
    assert.equal((await worker.fetch(request(),{})).status,503);
  }finally{sqlite.close();}
});
