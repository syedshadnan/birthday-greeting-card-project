export const isPremium = process.env.NEXT_PUBLIC_CARD_PREMIUM_ENABLED !== 'false'
export const premiumCardFeatures = {
  password: isPremium,
} as const
