// Runs every migration on an embedded Postgres (PGlite) and checks the payment rules.
// Usage: npm install --no-save @electric-sql/pglite && node supabase/tests/payment-integrity.pglite.mjs supabase/migrations
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'

const dir = process.argv[2] ?? 'supabase/migrations'
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
// Supabase grants table privileges to API roles by default; the migrations then revoke what they must.
await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`)
for (const file of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(`${dir}/${file}`, 'utf8').replace(/^﻿/, ''))
}
console.log('All migrations applied.\n')

const user = async email => (await q(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id
let slug = 0
const card = async userId => (await q(`insert into cards (public_id, recipient_name, sender_name, message, expires_at, user_id) values ($1, 'R', 'S', 'M', now() + interval '7 days', $2) returning id`, [`card${String(++slug).padStart(9, '0')}`, userId]))[0].id
// Receiving accounts exist so orders can show a number, but carry no trust metadata
// and are inactive: automatic verification must not depend on them.
const [bk] = await q(`insert into payment_accounts (method, account_number) values ('bkash', '01874768164') returning id`)
const [ng] = await q(`insert into payment_accounts (method, account_number) values ('nagad', '01874768164') returning id`)
const order = async (userId, cardId, method, phone) => (await q(`insert into orders (user_id, card_id, payment_method, customer_phone, payment_account_id) values ($1, $2, $3, $4, $5) returning id`, [userId, cardId, method, phone, method === 'bkash' ? bk.id : ng.id]))[0].id
const status = async orderId => (await q(`select status from orders where id = $1`, [orderId]))[0].status

let n = 0
// A stored webhook event plus parsed evidence, as the webhook route creates it.
const sms = async ({ provider, amount = 99, sender, txn, process = true }) => {
  n++
  const [event] = await q(`insert into webhook_events (external_event_id, source, event_type, raw_payload, raw_message) values ($1, 'forwarder', 'sms', '{}', 'raw sms') returning id`, [`evt-${n}`])
  const [v] = await q(`insert into payment_verifications (webhook_event_id, provider, amount_bdt, sender_phone, transaction_id, verification_status, reason_code, reason, raw_evidence) values ($1, $2, $3, $4, $5, $6, $7, 'stored', '{}') returning id`,
    [event.id, provider ?? null, provider ? amount : null, provider ? sender : null, provider ? txn : null, provider ? 'needs_review' : 'invalid', provider ? 'PENDING_AUTOMATIC_VERIFICATION' : 'INVALID_SMS_FORMAT'])
  if (!process) return { verificationId: v.id, eventId: event.id }
  const [result] = await q(`select * from process_sms_payment_verification($1)`, [v.id])
  return { ...result, verificationId: v.id, eventId: event.id }
}

const u = await user('customer@x.com')

// TEST 1
let o = await order(u, await card(u), 'bkash', '01715677939')
let r = await sms({ provider: 'bkash', sender: '01715677939', txn: 'DJ32C0VI42' })
ok(r.out_status === 'verified' && r.out_order_id === o && await status(o) === 'paid', `TEST 1  bKash 99, sender matches -> AUTO VERIFIED (${r.out_reason_code})`)
const [ev] = await q(`select status, verification_status, matched_order_id from webhook_events where id = $1`, [r.eventId])
ok(ev.status === 'processed' && ev.matched_order_id === o, '        webhook evidence records outcome and matched order')

// TEST 2
o = await order(u, await card(u), 'nagad', '01632951891')
r = await sms({ provider: 'nagad', sender: '01632951891', txn: '75K92M3Z' })
ok(r.out_status === 'verified' && await status(o) === 'paid', `TEST 2  Nagad 99, sender matches -> AUTO VERIFIED (${r.out_reason_code})`)

// TEST 3, 4
o = await order(u, await card(u), 'bkash', '01711111111')
r = await sms({ provider: 'bkash', amount: 60, sender: '01711111111', txn: 'BK60' })
ok(r.out_status !== 'verified' && await status(o) === 'pending', `TEST 3  bKash 60 -> NOT PAID (${r.out_reason_code})`)
r = await sms({ provider: 'bkash', amount: 100, sender: '01711111111', txn: 'BK100' })
ok(r.out_status !== 'verified' && await status(o) === 'pending', `        bKash 100 -> NOT PAID (${r.out_reason_code})`)
const o4 = await order(u, await card(u), 'nagad', '01722222222')
r = await sms({ provider: 'nagad', amount: 60, sender: '01722222222', txn: 'NG60' })
ok(r.out_status !== 'verified' && await status(o4) === 'pending', `TEST 4  Nagad 60 -> NOT PAID (${r.out_reason_code})`)

// TEST 5, 6
r = await sms({ provider: 'bkash', sender: '01799999999', txn: 'BKWRONG' })
ok(r.out_status !== 'verified' && await status(o) === 'pending', `TEST 5  bKash 99, wrong sender -> NOT PAID (${r.out_reason_code})`)
r = await sms({ provider: 'nagad', sender: '01799999999', txn: 'NGWRONG' })
ok(r.out_status !== 'verified' && await status(o4) === 'pending', `TEST 6  Nagad 99, wrong sender -> NOT PAID (${r.out_reason_code})`)

// TEST 7, 8 (o4 is a Nagad order, o is a bKash order)
r = await sms({ provider: 'bkash', sender: '01722222222', txn: 'BKFORNG' })
ok(r.out_status !== 'verified' && await status(o4) === 'pending', `TEST 7  bKash SMS + Nagad order -> NOT PAID (${r.out_reason_code})`)
r = await sms({ provider: 'nagad', sender: '01711111111', txn: 'NGFORBK' })
ok(r.out_status !== 'verified' && await status(o) === 'pending', `TEST 8  Nagad SMS + bKash order -> NOT PAID (${r.out_reason_code})`)

// TEST 9 (the parser returns no fields for unsupported text; see payment-verification.test.ts)
r = await sms({ provider: null })
ok(r.out_status === 'invalid' && await status(o) === 'pending', `TEST 9  unsupported SMS format -> NOT PAID (${r.out_reason_code})`)

// TEST 10
const oA = await order(u, await card(u), 'bkash', '01733333333')
r = await sms({ provider: 'bkash', sender: '01733333333', txn: 'ONCE1' })
ok(r.out_status === 'verified' && await status(oA) === 'paid', '        first delivery of transaction ONCE1 credits order A')
r = await sms({ provider: 'bkash', sender: '01733333333', txn: 'ONCE1' })
ok(r.out_status === 'duplicate', `TEST 10 same transaction ID again -> duplicate (${r.out_reason_code})`)
const oC = await order(u, await card(u), 'bkash', '01733333333')
r = await sms({ provider: 'bkash', sender: '01733333333', txn: 'ONCE1' })
ok(r.out_status === 'duplicate' && await status(oC) === 'pending', '        credited transaction cannot pay a second order')
await expectError(`select admin_approve_payment($1, $2, null, 'admin reuses credited sms')`, [oC, r.verificationId], /already been credited/, '        admin cannot re-credit the same transaction')
ok((await q(`select count(*)::int n from payment_verifications where transaction_id = 'ONCE1' and verification_status = 'verified'`))[0].n === 1, '        exactly one verified record for ONCE1')

// Retry after an uncredited attempt: needs_review, then the order exists -> AUTO VERIFIED.
const lateWallet = '01755555555'
r = await sms({ provider: 'bkash', sender: lateWallet, txn: 'RETRY1' })
ok(r.out_reason_code === 'NO_MATCHING_ORDER', '        SMS before order exists -> needs_review')
const oLate = await order(u, await card(u), 'bkash', lateWallet)
r = await sms({ provider: 'bkash', sender: lateWallet, txn: 'RETRY1' })
ok(r.out_status === 'verified' && await status(oLate) === 'paid', `        retry of uncredited transaction -> AUTO VERIFIED (${r.out_reason_code})`)
// Stored evidence whose processing failed, then a retry.
const oFail = await order(u, await card(u), 'nagad', '01766666666')
const failed = await sms({ provider: 'nagad', sender: '01766666666', txn: 'RETRY2', process: false })
r = await sms({ provider: 'nagad', sender: '01766666666', txn: 'RETRY2' })
ok(r.out_status === 'verified' && await status(oFail) === 'paid', '        retry after failed processing -> AUTO VERIFIED')
const [late] = await q(`select * from process_sms_payment_verification($1)`, [failed.verificationId])
ok(late.out_status === 'duplicate', '        the earlier unprocessed copy then resolves as duplicate')

// TEST 11
const paidCard = (await q(`select card_id from orders where id = $1`, [oA]))[0].card_id
await expectError(`insert into orders (user_id, card_id, payment_method, customer_phone, payment_account_id) values ($1, $2, 'nagad', '01733333333', $3)`, [u, paidCard, ng.id], /CARD_ALREADY_PAID/, 'TEST 11 paid card attempts another payment -> blocked')

// TEST 12
const oManual = await order(u, await card(u), 'nagad', '01777777777')
const evidence = await sms({ provider: 'nagad', sender: '01700000000', txn: 'MANUAL1' })
const [approved] = await q(`select admin_approve_payment($1, $2, null, 'customer paid from another wallet') as id`, [oManual, evidence.verificationId])
const [audit] = await q(`select reason_code, payment_verification_source, transaction_id, payment_evidence_available from payment_verification_audit where order_id = $1`, [oManual])
ok(approved.id === oManual && await status(oManual) === 'paid' && audit?.payment_verification_source === 'MANUAL_ADMIN' && audit.transaction_id === 'MANUAL1' && audit.payment_evidence_available,
  'TEST 12 admin approves evidence -> PAID + audit record')
const oNoEvidence = await order(u, await card(u), 'bkash', '01788888888')
await q(`select admin_approve_payment($1, null, null, 'verified in bkash merchant app')`, [oNoEvidence])
const [audit2] = await q(`select reason_code, payment_evidence_available from payment_verification_audit where order_id = $1`, [oNoEvidence])
ok(await status(oNoEvidence) === 'paid' && audit2?.reason_code === 'MANUAL_APPROVAL_NO_EVIDENCE' && audit2.payment_evidence_available === false, '        admin approves without SMS evidence -> PAID + audit record')
await expectError(`select admin_approve_payment($1, null, null, 'short')`, [oNoEvidence], /APPROVAL_REJECTED/, '        approval needs a reason and a pending order')

// TEST 13, 14 (route decision is unit tested in src/lib/cards/access.test.ts)
await q(`update cards set admin_locked_at = now() where id = $1`, [paidCard])
ok((await q(`select admin_locked_at from cards where id = $1`, [paidCard]))[0].admin_locked_at !== null, 'TEST 13 admin lock is stored on the card')
await q(`update cards set admin_locked_at = null where id = $1`, [paidCard])
ok((await q(`select admin_locked_at from cards where id = $1`, [paidCard]))[0].admin_locked_at === null && await status(oA) === 'paid', 'TEST 14 admin unlock clears the lock; payment state unchanged')

// TEST 15
const deletedResult = (await q(`select admin_delete_card($1) as outcome`, [paidCard]))[0].outcome
const [archived] = await q(`select status, deleted_at, share_enabled_at from cards where id = $1`, [paidCard])
ok(deletedResult === 'archived' && archived.status === 'expired' && archived.deleted_at !== null, 'TEST 15 card with payments is removed from customer view (archived)')
ok(await status(oA) === 'paid'
  && (await q(`select count(*)::int n from payment_verifications where order_id = $1`, [oA]))[0].n >= 1
  && (await q(`select count(*)::int n from payment_verification_audit where order_id = $1`, [oA]))[0].n >= 1
  && (await q(`select count(*)::int n from webhook_events where matched_order_id = $1`, [oA]))[0].n >= 1,
  '        order, verification, audit, and webhook evidence preserved')
const pendingCard = (await q(`select card_id from orders where id = $1`, [o4]))[0].card_id
await q(`select admin_delete_card($1)`, [pendingCard])
ok(await status(o4) === 'cancelled', '        pending order on a deleted card is cancelled, not deleted')
const emptyCard = await card(u)
ok((await q(`select admin_delete_card($1) as outcome`, [emptyCard]))[0].outcome === 'deleted'
  && (await q(`select count(*)::int n from cards where id = $1`, [emptyCard]))[0].n === 0, '        card without payment history is fully deleted')

// Admin-only: client roles cannot call admin or verification functions or write cards/orders.
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${u}', false);`)
await expectError(`select admin_approve_payment($1, null, null, 'client approval attempt')`, [oC], /permission denied/, '        client cannot approve payment')
await expectError(`select admin_delete_card($1)`, [emptyCard], /permission denied/, '        client cannot delete cards')
await expectError(`update cards set admin_locked_at = null`, [], /permission denied/, '        client cannot lock/unlock cards')
await expectError(`update orders set status = 'paid' where id = $1`, [oC], /permission denied/, '        client cannot mark an order paid')
await expectError(`select * from process_sms_payment_verification($1)`, [r.verificationId], /permission denied/, '        client cannot run verification')
await db.exec(`reset role;`)

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
