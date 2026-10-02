import CardDelivery from '../../../components/premium-cards/delivery'

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CardDelivery cardId={id} template="Birthday card" />
}
