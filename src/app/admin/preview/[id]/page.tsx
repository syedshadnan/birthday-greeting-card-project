import type { Metadata } from 'next'
import CardExperience from '../../../../components/card-experience'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Private admin card preview',
  robots: { index: false, follow: false },
}

export default async function AdminCardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CardExperience slug="admin-preview" adminPreviewId={id} />
}
