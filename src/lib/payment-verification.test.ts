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
  providerTimestamp: '2026-10-03T08:45:00.000Z',
  fee: 0,
  reference: null,
  balance: 19739.48,
})
