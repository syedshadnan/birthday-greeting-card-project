import type { MetadataRoute } from 'next'
import { getSiteUrl } from '../lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const paths = [
    '',
    '/templates',
    '/birthday-cards',
    '/birthday-cards/cute',
    '/birthday-cards/romantic',
    '/birthday-cards/cartoon',
    '/birthday-cards/best-friend',
    '/privacy',
    '/terms',
    '/refund',
  ]
  return paths.map(path => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
