export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?.trim()
    .replace(/\/$/, '')

  // Production canonical URL
  if (
    envUrl &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1')
  ) {
    return envUrl
  }

  // Local development
  if (process.env.NODE_ENV === 'development') {
    return envUrl || 'http://localhost:3000'
  }

  // Production canonical fallback
  return 'https://www.birthdaysmile.me'
}