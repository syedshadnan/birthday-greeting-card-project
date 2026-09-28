import type { MetadataRoute } from 'next'
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/create','/admin','/payment','/share','/card','/private']},sitemap:(process.env.NEXT_PUBLIC_SITE_URL || 'https://wishwell.cards')+'/sitemap.xml'}}
