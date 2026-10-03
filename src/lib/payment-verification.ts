import { normalizeBangladeshPhone } from './payment-accounts'

export type ParsedSms = {
  provider: 'bkash' | 'nagad'
  direction: 'received'
  amountBdt: number
  senderPhone: string | null
  transactionId: string | null
  providerTimestamp: string | null
  fee: number | null
  reference: string | null
  balance: number | null
}

const bkashPattern = /^You have received Tk (\d+\.\d{2}) from (01[3-9]\d{8})\. Fee Tk (\d+\.\d{2})\. Balance Tk ((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})\. TrxID ([A-Z0-9]+) at (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})$/
const nagadPattern = /^Money Received\.\r?\nAmount: Tk (\d+\.\d{2})\r?\nSender: (01[3-9]\d{8})\r?\nRef: (.+)\r?\nTxnID: ([A-Z0-9]+)\r?\nBalance: Tk (\d+\.\d{2})\r?\n(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})$/

function timestamp(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(`${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:00Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function parseSupportedSms(message: unknown): ParsedSms | null {
  if (typeof message !== 'string') return null
  const bkash = bkashPattern.exec(message)
  if (bkash) return {
    provider: 'bkash', direction: 'received', amountBdt: Number(bkash[1]),
    senderPhone: normalizeBangladeshPhone(bkash[2]), transactionId: bkash[5],
    providerTimestamp: timestamp(bkash[6]), fee: Number(bkash[3]), reference: null, balance: Number(bkash[4].replace(/,/g, '')),
  }
  const nagad = nagadPattern.exec(message)
  if (!nagad) return null
  return {
    provider: 'nagad', direction: 'received', amountBdt: Number(nagad[1]),
    senderPhone: normalizeBangladeshPhone(nagad[2]), transactionId: nagad[5],
    providerTimestamp: timestamp(nagad[7]), fee: null, reference: nagad[4], balance: Number(nagad[6]),
  }
}
