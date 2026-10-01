import type { Metadata } from 'next'
import CardExperience from '../../../components/card-experience'

export const dynamic = 'force-dynamic'

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

  return {
    title: 'A private birthday surprise',
    description: 'A personal birthday story, shared with a password.',
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      title: 'A private birthday surprise',
      description: 'A personal birthday story, shared with a password.',
    },
    twitter: { card: 'summary', title: 'A private birthday surprise', description: 'A personal birthday story, shared with a password.' },
  }
}

export default async function BirthdayCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CardExperience slug={slug} />
}
