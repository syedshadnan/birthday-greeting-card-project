const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getSupabaseConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  return { url: supabaseUrl, key: serviceRoleKey }
}

export async function supabaseRequest(
  path: string,
  init: RequestInit = {},
  options: { ignoreNotFound?: boolean } = {},
) {
  const { url, key } = getSupabaseConfig()
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...init.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok && !(options.ignoreNotFound && response.status === 404)) {
    const detail = await response.text()
    throw new Error(`Supabase request failed (${response.status}): ${detail}`)
  }

  return response
}
