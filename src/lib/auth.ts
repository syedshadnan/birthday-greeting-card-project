import { createSupabaseServerClient, hasSupabaseAuthConfig } from './supabase/server'

export async function getCurrentUser() {
  if (!hasSupabaseAuthConfig()) return null

  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data
}

export async function getCurrentUserRole() {
  const profile = await getCurrentProfile()
  return profile?.role === 'admin' ? 'admin' : 'user'
}

export async function getCurrentOwnedCards() {
  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createSupabaseServerClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('cards')
    .select('public_id, recipient_name, created_at, expires_at, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('AUTH_REQUIRED')
  }
  return user
}

export async function requireAdminUser() {
  const user = await requireAuthenticatedUser()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    throw new Error('ADMIN_REQUIRED')
  }

  return user
}
