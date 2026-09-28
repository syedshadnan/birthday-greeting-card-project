export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')

  // In production builds, never output localhost into sitemaps or metadata
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl
  }

  // Vercel system production domain
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Any Vercel preview or deployment domain
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  // If running locally in development mode, localhost is fine
  if (process.env.NODE_ENV === 'development' && envUrl) {
    return envUrl
  }

  // Canonical production fallback
  return 'https://birthday-greeting-card-project.vercel.app'
}
