import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'

const dir = process.argv[2]
const db = new PGlite({ extensions: { pgcrypto } })
let failures = 0
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }
const q = async (sql, params) => (await db.query(sql, params)).rows
const expectError = async (sql, params, pattern, label) => {
  try { await db.query(sql, params); ok(false, `${label} (no error)`) }
  catch (error) { ok(pattern.test(error.message), `${label} -> ${error.message}`) }
}

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  grant usage on schema public, auth to anon, authenticated, service_role;
`)
for (const file of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) {
  const sql = readFileSync(`${dir}/${file}`, 'utf8').replace(/^﻿/, '')
  await db.exec(sql)
}
// Supabase grants table privileges to API roles by default.
await db.exec(`grant all on all tables in schema public to anon, authenticated, service_role;
  revoke update on public.cards from anon, authenticated;
  revoke update, delete on public.orders from authenticated;`)
console.log('All migrations applied.')

const [u1] = await q(`insert into auth.users (email) values ('a@x.com') returning id`)
const [u2] = await q(`insert into auth.users (email) values ('b@x.com') returning id`)
const card = async (userId, slug) => (await q(`insert into cards (public_id, recipient_name, sender_name, message, expires_at, user_id) values ($1, 'R', 'S', 'M', now() + interval '7 days', $2) returning id`, [slug, userId]))[0].id
const c1 = await card(u1.id, 'card000000001')
const c2 = await card(u2.id, 'card000000002')
const c3 = await card(u2.id, 'card000000003')

// Issue 10: same SIM and receiving number for both providers.
const [bk] = await q(`insert into payment_accounts (method, account_number, webhook_source, provider_account_number) values ('bkash', '01874768164', 'sim1', '01874768164') returning id`)
const [ng] = await q(`insert into payment_accounts (method, account_number, webhook_source, provider_account_number) values ('nagad', '01874768164', 'sim1', '01874768164') returning id`)
await q(`select activate_payment_account($1)`, [bk.id])
await q(`select activate_payment_account($1)`, [ng.id])
ok((await q(`select count(*)::int n from payment_accounts where is_active`))[0].n === 2, 'bKash and Nagad both active with sim1 + 01874768164')

const order = async (userId, cardId, method, phone, accountId) => (await q(`insert into orders (user_id, card_id, payment_method, customer_phone, payment_account_id) values ($1, $2, $3, $4, $5) returning id`, [userId, cardId, method, phone, accountId]))[0].id
const o1 = await order(u1.id, c1, 'bkash', '01715677939', bk.id)
// Unrelated abandoned pending order on the same account must not block matching.
await order(u2.id, c3, 'bkash', '01999999999', bk.id)

let n = 0
const sms = async ({ provider, amount = 99, sender, txn, source = 'sim1', account = '01874768164' }) => {
  n++
  const [event] = await q(`insert into webhook_events (external_event_id, source, event_type, raw_payload, raw_message, trusted_source, trusted_receiving_account) values ($1, 'forwarder', 'sms', '{}', 'raw sms', $2, $3) returning id`, [`evt-${n}`, source, account])
  const [v] = await q(`insert into payment_verifications (webhook_event_id, provider, amount_bdt, sender_phone, transaction_id, trusted_source, trusted_receiving_account, verification_status, reason_code, reason, raw_evidence) values ($1, $2, $3, $4, $5, $6, $7, 'needs_review', 'PENDING_AUTOMATIC_VERIFICATION', 'pending', '{}') returning id`, [event.id, provider, amount, sender, txn, source, account])
  const [result] = await q(`select * from process_sms_payment_verification($1)`, [v.id])
  return { ...result, verificationId: v.id, eventId: event.id }
}

let r = await sms({ provider: 'bkash', sender: '01715677939', txn: 'DIQ8WGNV0G' })
ok(r.out_status === 'verified' && r.out_order_id === o1, `bKash auto-verifies the one matching order despite another pending order (${r.out_reason_code})`)
ok((await q(`select status, payment_verification_source from orders where id = $1`, [o1]))[0].status === 'paid', 'order o1 is paid')
const [ev] = await q(`select status, verification_status, matched_order_id, processed_at from webhook_events where id = $1`, [r.eventId])
ok(ev.status === 'processed' && ev.verification_status === 'verified' && ev.matched_order_id === o1 && ev.processed_at, 'webhook event updated with outcome and matched order')
ok((await q(`select count(*)::int n from payment_verification_audit where order_id = $1 and payment_verification_source = 'AUTOMATIC'`, [o1]))[0].n === 1, 'automatic verification is audited')

r = await sms({ provider: 'bkash', sender: '01715677939', txn: 'DIQ8WGNV0G' })
ok(r.out_status === 'duplicate', `repeated transaction ID is a duplicate (${r.out_reason_code})`)

await expectError(`insert into orders (user_id, card_id, payment_method, customer_phone, payment_account_id) values ($1, $2, 'nagad', '01715677939', $3)`, [u1.id, c1, ng.id], /CARD_ALREADY_PAID/, 'paid card rejects a new pending order')

// Wrong customer wallet: no auto-pay, admin approves with evidence.
const o2 = await order(u2.id, c2, 'nagad', '01632951891', ng.id)
r = await sms({ provider: 'nagad', sender: '01700000000', txn: '75K92M3Z' })
ok(r.out_status === 'needs_review' && r.out_reason_code === 'NO_MATCHING_ORDER', `sender mismatch is not auto-paid (${r.out_reason_code})`)
ok((await q(`select status from orders where id = $1`, [o2]))[0].status === 'pending', 'order o2 still pending')

await expectError(`select approve_payment_with_evidence($1, $2, null, 'short')`, [o2, r.verificationId], /reason of at least 10/, 'approval requires a reason')
await expectError(`select approve_payment_with_evidence($1, $2, null, 'customer paid from spouse wallet')`, [o1, r.verificationId], /APPROVAL_REJECTED/, 'evidence cannot pay an already-paid order')
const [approved] = await q(`select approve_payment_with_evidence($1, $2, null, 'customer paid from spouse wallet') as id`, [o2, r.verificationId])
ok(approved.id === o2, 'evidence-bound manual approval pays o2')
const [audit] = await q(`select reason_code, payment_verification_source, transaction_id from payment_verification_audit where order_id = $1`, [o2])
ok(audit.reason_code === 'MANUAL_APPROVAL_SENDER_MISMATCH' && audit.payment_verification_source === 'MANUAL_ADMIN' && audit.transaction_id === '75K92M3Z', 'manual approval audited with sender-mismatch flag')
const o3 = await order(u2.id, c3, 'nagad', '01632951891', ng.id)
await expectError(`select approve_payment_with_evidence($1, $2, null, 'trying to reuse the same sms')`, [o3, r.verificationId], /already been credited/, 'same evidence cannot be credited twice')

// Evidence that does not qualify.
r = await sms({ provider: 'nagad', amount: 60, sender: '01632951891', txn: 'AMT60' })
ok(r.out_status === 'needs_review' && r.out_reason_code === 'AMOUNT_MISMATCH' && r.out_order_id === o3, `wrong amount goes to review linked to candidate (${r.out_reason_code})`)
await expectError(`select approve_payment_with_evidence($1, $2, null, 'admin tries to approve 60 taka')`, [o3, r.verificationId], /not 99 BDT/, 'admin cannot approve wrong-amount evidence')
r = await sms({ provider: 'nagad', sender: '01632951891', txn: 'UNTRUSTED1', source: 'random-phone' })
ok(r.out_status === 'needs_review' && r.out_reason_code === 'RECEIVING_ACCOUNT_UNKNOWN', `unknown SMS source is not auto-paid (${r.out_reason_code})`)
await expectError(`select approve_payment_with_evidence($1, $2, null, 'admin tries untrusted evidence')`, [o3, r.verificationId], /receiving account does not match/, 'admin cannot approve untrusted-source evidence')
r = await sms({ provider: 'bkash', sender: '01632951891', txn: 'WRONGPROV' })
ok(r.out_status === 'needs_review', `provider must match order method (${r.out_reason_code})`)

// Two pending orders with the same wallet are ambiguous.
const [u3] = await q(`insert into auth.users (email) values ('c@x.com') returning id`)
await order(u3.id, await card(u3.id, 'card000000004'), 'bkash', '01811111111', bk.id)
await order(u3.id, await card(u3.id, 'card000000005'), 'bkash', '01811111111', bk.id)
r = await sms({ provider: 'bkash', sender: '01811111111', txn: 'MULTI1' })
ok(r.out_reason_code === 'MULTIPLE_MATCHING_ORDERS', `ambiguous match is not auto-paid (${r.out_reason_code})`)

// Direct paid transition on an already-paid card is blocked.
const o1b = await order(u1.id, await card(u1.id, 'card000000006'), 'bkash', '01722222222', bk.id)
const o1c = await order(u1.id, (await q(`select card_id from orders where id = $1`, [o1b]))[0].card_id, 'nagad', '01722222222', ng.id)
await q(`update orders set status = 'paid' where id = $1`, [o1b])
await expectError(`update orders set status = 'paid' where id = $1`, [o1c], /CARD_ALREADY_PAID/, 'second paid order on the same card is blocked')
ok((await q(`select count(*)::int n from pg_indexes where indexname = 'orders_one_paid_per_card_idx'`))[0].n === 1, 'unique paid-per-card index created')
await q(`update orders set payment_submitted_at = now() where id = $1`, [o1c])
ok(true, 'pending order on a paid card can still be updated (no trigger false positive)')

// Account activation only affects one method.
const [bk2] = await q(`insert into payment_accounts (method, account_number) values ('bkash', '01811112222') returning id`)
await q(`select activate_payment_account($1)`, [bk2.id])
const active = await q(`select method, id from payment_accounts where is_active order by method`)
ok(active.length === 2 && active.find(a => a.method === 'bkash').id === bk2.id && active.find(a => a.method === 'nagad').id === ng.id, 'activating new bKash leaves Nagad active')
ok((await q(`select payment_account_id from orders where id = $1`, [o1]))[0].payment_account_id === bk.id, 'historical order keeps old receiving account')
await expectError(`update payment_accounts set account_number = '01999999998' where id = $1`, [bk.id], /immutable/, 'receiving number is immutable')

// Removed unrestricted approval paths.
ok((await q(`select count(*)::int n from pg_proc where proname in ('approve_manual_payment_order', 'approve_payment_verification')`))[0].n === 0, 'unrestricted approval functions removed')

// Client roles.
const cUnpaid = await card(u1.id, 'card000000007')
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${u2.id}', false);`)
await expectError(`update cards set share_enabled_at = now() where public_id = 'card000000002'`, [], /permission denied/, 'client cannot set share_enabled_at')
await expectError(`update orders set status = 'paid' where id = $1`, [o3], /permission denied/, 'client cannot mark order paid')
await expectError(`select approve_payment_with_evidence($1, $2, null, 'client attempts approval')`, [o3, r.verificationId], /permission denied/, 'client cannot call approval RPC')
await expectError(`select * from process_sms_payment_verification($1)`, [r.verificationId], /permission denied/, 'client cannot call verification RPC')
ok((await q(`select count(*)::int n from webhook_events`)).length === 1 && (await q(`select count(*)::int n from webhook_events`))[0].n === 0, 'client cannot read webhook evidence')
ok((await q(`select count(*)::int n from orders`))[0].n === 3, 'client sees only own orders (u2 has 3)')
await expectError(`insert into orders (user_id, card_id, payment_method, customer_phone, payment_account_id) values ($1, $2, 'nagad', '01632951891', $3)`, [u2.id, c2, ng.id], /CARD_ALREADY_PAID/, 'client direct insert for paid card is blocked')
await expectError(`insert into orders (user_id, card_id, payment_method, customer_phone, payment_account_id) values ($1, $2, 'nagad', '01632951891', $3)`, [u2.id, cUnpaid, ng.id], /row-level security/, 'client cannot create order for another user card')
await db.exec(`reset role;`)

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
