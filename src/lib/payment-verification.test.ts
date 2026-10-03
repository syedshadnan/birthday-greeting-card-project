import assert from 'node:assert/strict'
import { parseSupportedSms } from './payment-verification'

const parsed = parseSupportedSms(
  'You have received Tk 99.00 from 01715677939. Fee Tk 0.00. Balance Tk 19,739.48. TrxID DJ31B0WVG at 03/10/2026 08:45',
)

assert.deepEqual(parsed, {
  provider: 'bkash',
  direction: 'received',
  amountBdt: 99,
  senderPhone: '01715677939',
  transactionId: 'DJ31B0WVG',
  providerTimestamp: '2026-10-03T02:45:00.000Z',
  fee: 0,
  reference: null,
  balance: 19739.48,
})

assert.deepEqual(parseSupportedSms(
  'You have received Tk 300.00 from 01715677939. Fee Tk 0.00. Balance Tk 303.03. TrxID DIQ8WGNV0G at 26/09/2026 18:41',
), {
  provider: 'bkash',
  direction: 'received',
  amountBdt: 300,
  senderPhone: '01715677939',
  transactionId: 'DIQ8WGNV0G',
  providerTimestamp: '2026-09-26T12:41:00.000Z',
  fee: 0,
  reference: null,
  balance: 303.03,
})

const nagad = {
  provider: 'nagad',
  direction: 'received',
  amountBdt: 60,
  senderPhone: '01632951891',
  transactionId: '75K92M3Z',
  providerTimestamp: '2026-06-24T08:31:00.000Z',
  fee: null,
  reference: 'N/A',
  balance: 610.28,
}

assert.deepEqual(parseSupportedSms(
  'Money Received.\nAmount: Tk 60.00\nSender: 01632951891\nRef: N/A\nTxnID: 75K92M3Z\nBalance: Tk 610.28\n24/06/2026 14:31',
), nagad)

assert.deepEqual(parseSupportedSms(
  'Money Received.\r\nAmount: Tk 60.00\r\nSender: 01632951891\r\nRef: N/A\r\nTxnID: 75K92M3Z\r\nBalance: Tk 1,610.28\r\n24/06/2026 14:31\n',
), { ...nagad, balance: 1610.28 })

assert.deepEqual(parseSupportedSms(
  'You have received Tk 99.00 from 01715677939. Fee Tk 0.00. Balance Tk 19,282.48. TrxID DJ32C0VI42 at 03/10/2026 10:16',
), {
  provider: 'bkash',
  direction: 'received',
  amountBdt: 99,
  senderPhone: '01715677939',
  transactionId: 'DJ32C0VI42',
  providerTimestamp: '2026-10-03T04:16:00.000Z',
  fee: 0,
  reference: null,
  balance: 19282.48,
})

assert.equal(parseSupportedSms(
  'Money Received.\nAmount: Tk 99.00\nSender: 01632951891\nRef: N/A\nTxnID: 75K92M3Z\nBalance: Tk 610.28\n24/06/2026 14:31',
)?.amountBdt, 99)

// Unsupported formats are not parsed.
assert.equal(parseSupportedSms('You have received Tk 99.00 from 01715677939. TrxID DJ32C0VI42 at 03/10/2026 10:16'), null)
assert.equal(parseSupportedSms('Cash In Tk 99.00 from 01715677939 successful. TrxID DJ32C0VI42'), null)
assert.equal(parseSupportedSms('You have sent Tk 99.00 to 01715677939. TrxID ABC at 03/10/2026 08:45'), null)
assert.equal(parseSupportedSms('Money Sent.\nAmount: Tk 99.00'), null)
assert.equal(parseSupportedSms(null), null)
