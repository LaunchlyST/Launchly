import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('SQL migration enforces billing protection, private cache and distributed request limits', async () => {
  const db = new PGlite();
  try {
    // Minimal existing schema/roles; no production users, credentials or data.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.users(id uuid primary key, subscription_status text);
      alter table public.users enable row level security;
      grant all on public.users to anon, authenticated, service_role;
      create policy "Users can update own data" on public.users for update using(true);
      create policy "Service role full access" on public.users for all using(true) with check(true);
      insert into auth.users values('11111111-1111-4111-8111-111111111111');
      insert into public.users values('11111111-1111-4111-8111-111111111111', 'inactive');`);
    await db.exec(await readFile(new URL('../subscription-backend/supabase/migrations/002_creator_api.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../subscription-backend/supabase/migrations/003_launchly_creator_plan.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated');
    await assert.rejects(db.exec("update public.users set subscription_status='active'"), /permission denied/);
    await assert.rejects(db.exec("update public.users set creator_api_plan_verified=true"), /permission denied/);
    await assert.rejects(db.exec('select * from public.creator_api_cache'), /permission denied/);
    await assert.rejects(db.exec("select public.acquire_creator_request('11111111-1111-4111-8111-111111111111','test')"), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.exec('select * from public.creator_api_cache'), /permission denied/);
    await db.exec('reset role; set role service_role');
    const acquire = async key => (await db.query('select public.acquire_creator_request($1, $2) as id', ['11111111-1111-4111-8111-111111111111', key])).rows[0].id;
    const first = await acquire('search:a'); assert.ok(first);
    assert.equal(await acquire('search:a'), null, 'duplicate in-flight request denied');
    assert.ok(await acquire('search:b')); assert.ok(await acquire('search:c'));
    assert.equal(await acquire('search:d'), null, 'fourth concurrent request denied');
    await db.query('update creator_request_leases set released=true where id=$1', [first]);
    assert.ok(await acquire('search:d'), 'released lease frees a slot');
    await db.exec('delete from creator_request_leases');
    for (let i = 0; i < 30; i++) {
      const id = await acquire('query:' + i); assert.ok(id);
      await db.query('update creator_request_leases set released=true where id=$1', [id]);
    }
    assert.equal(await acquire('query:31'), null, '31st request within a minute denied');
    await db.exec("update creator_request_leases set started_at=now()-interval '61 seconds'");
    assert.ok(await acquire('after-window'), 'rate limit resets after the window');
    await db.exec("update creator_request_leases set started_at=now()-interval '31 seconds'");
    assert.ok(await acquire('after-window'), 'crashed request lease expires');
    await db.exec("insert into creator_api_cache(cache_key,response,expires_at) values('key','{}',now()+interval '6 hours')");
    await assert.rejects(db.exec("insert into creator_api_cache(cache_key,response,expires_at) values('key','{}',now())"), /duplicate key/);
  } finally { await db.close(); }
});
