import { supabaseRequest } from './supabase/server'

export const paymentMethods = ['bkash', 'nagad'] as const
export type PaymentMethod = typeof paymentMethods[number]

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && paymentMethods.includes(value as PaymentMethod)
}

export function normalizeBangladeshPhone(value: unknown) {
  if (typeof value !== 'string') return null
  const digits = value.trim().replace(/[\s-]/g, '')
  if (/^8801[3-9]\d{8}$/.test(digits)) return `0${digits.slice(2)}`
  if (/^01[3-9]\d{8}$/.test(digits)) return digits
  return null
}

export async function getActivePaymentAccount(method: PaymentMethod) {
  const response = await supabaseRequest(
    `/rest/v1/payment_accounts?method=eq.${method}&is_active=eq.true&select=id,method,account_number&limit=1`,
  )
  const [account] = await response.json() as { id: string; method: PaymentMethod; account_number: string }[]
  return account ?? null
}
