import type { Metadata } from 'next'
import CardExperience from '../../../components/card-experience'
import { supabaseRequest } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type CardMetadataRow = {
  public_id: string
  recipient_name: string
  expires_at: string
  card_config: { photos?: { url: string }[] } | null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (slug === 'demo') {
    return {
      title: 'A birthday story for Maya · Demo',
      description: 'An illustrated birthday story with English and Bangla wishes.',
      robots: { index: false, follow: false },
      openGraph: {
        type: 'website',
        title: 'A birthday story for Maya · Demo',
        description: 'An illustrated birthday story with English and Bangla wishes.',
      },
    }
  }

  if (!/^[a-z0-9]{12,32}$/.test(slug)) {
    return { title: 'A birthday surprise', robots: { index: false, follow: false } }
  }

  try {
    const response = await supabaseRequest(
      `/rest/v1/cards?public_id=eq.${slug}&status=in.(draft,published)&select=public_id,recipient_name,expires_at,card_config&limit=1`,
    )
    const [card] = await response.json() as CardMetadataRow[]
    if (!card || new Date(card.expires_at).getTime() <= Date.now()) {
      return { title: 'A birthday surprise', robots: { index: false, follow: false } }
    }

    const title = `A birthday story for ${card.recipient_name}`
    const description = `A little birthday story, made with love for ${card.recipient_name}.`
    const photo = card.card_config?.photos?.[0]?.url
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { type: 'website', title, description, ...(photo ? { images: [{ url: photo, width: 1200, height: 630 }] } : {}) },
      twitter: { card: 'summary_large_image', title, description, ...(photo ? { images: [photo] } : {}) },
    }
  } catch (error) {
    console.error('Could not generate birthday-card social metadata.', error)
    return { title: 'A birthday surprise', robots: { index: false, follow: false } }
  }
}

export default async function BirthdayCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CardExperience slug={slug} />
}
