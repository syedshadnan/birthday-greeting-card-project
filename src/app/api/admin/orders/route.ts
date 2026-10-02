import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession } from '../../../../lib/admin-auth'
import { supabaseRequest } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to view pending orders.' }, { status: 401 })
  }

  try {
    const [ordersResponse, cardsResponse, accountsResponse, profilesResponse] = await Promise.all([
      supabaseRequest('/rest/v1/orders?select=id,user_id,card_id,amount_bdt,currency,status,payment_method,customer_phone,payment_account_id,payment_submitted_at,created_at&status=eq.pending&order=created_at.desc'),
      supabaseRequest('/rest/v1/cards?select=id,public_id,recipient_name'),
      supabaseRequest('/rest/v1/payment_accounts?select=id,account_number,method'),
      supabaseRequest('/rest/v1/profiles?select=id,email,full_name'),
    ])

    const [orders, cards, accounts, profiles] = await Promise.all([
      ordersResponse.json() as Promise<{ id: string; user_id: string; card_id: string; amount_bdt: number; currency: string; status: string; payment_method: string; customer_phone: string; payment_account_id: string | null; payment_submitted_at: string | null; created_at: string }[]>,
      cardsResponse.json() as Promise<{ id: string; public_id: string; recipient_name: string | null }[]>,
      accountsResponse.json() as Promise<{ id: string; account_number: string; method: string }[]>,
      profilesResponse.json() as Promise<{ id: string; email: string | null; full_name: string | null }[]>,
    ])

    const cardsById = new Map(cards.map(card => [card.id, card]))
    const accountsById = new Map(accounts.map(account => [account.id, account]))
    const profilesById = new Map(profiles.map(profile => [profile.id, profile]))
    return NextResponse.json({
      orders: orders.map(order => ({
        ...order,
        card: cardsById.get(order.card_id) ?? null,
        payment_account: order.payment_account_id ? accountsById.get(order.payment_account_id) ?? null : null,
        customer: profilesById.get(order.user_id) ?? { id: order.user_id, email: null, full_name: null },
      })),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    console.error('Could not load pending orders for the admin dashboard.', error)
    return NextResponse.json({ error: 'Pending orders could not be loaded. Please try again.' }, { status: 500 })
  }
}
