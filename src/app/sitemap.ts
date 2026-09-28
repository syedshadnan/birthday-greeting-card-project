import type { MetadataRoute } from 'next'
const base=process.env.NEXT_PUBLIC_SITE_URL || 'https://wishwell.cards'
export default function sitemap():MetadataRoute.Sitemap { const paths=['','/templates','/birthday-cards','/birthday-cards/cute','/birthday-cards/romantic','/birthday-cards/cartoon','/birthday-cards/best-friend']; return paths.map(path=>({url:base+path,lastModified:new Date(),changeFrequency:path===''?'weekly':'monthly',priority:path===''?1:.7})) }
