export type PublicCardAccess = 'allowed' | 'locked' | 'not_shared' | 'unpaid'

// Recipient (non-owner) access: an admin lock always wins; otherwise the card must be
// shared by its owner and have a verified paid order.
export function publicCardAccess(card: { locked: boolean; shareEnabled: boolean; paid: boolean }): PublicCardAccess {
  if (card.locked) return 'locked'
  if (!card.shareEnabled) return 'not_shared'
  if (!card.paid) return 'unpaid'
  return 'allowed'
}
