export const cardThemes = {
  'royal-gold': { label: 'Royal gold', className: 'theme-royal' },
  'rose-romantic': { label: 'Rose romantic', className: 'theme-rose' },
  'midnight-galaxy': { label: 'Midnight galaxy', className: 'theme-midnight' },
  'pastel-cute': { label: 'Pastel cute', className: 'theme-pastel' },
} as const

export type CardTheme = keyof typeof cardThemes
export type CardLanguage = 'en' | 'bn'

export type CardConfig = {
  relationship: string
  language: CardLanguage
  openingLine: string
  letter: string
  reasons: string[]
  finalWish: string
  photos: { url: string; caption: string }[]
  songId: 'none' | 'custom'
}

export function sanitizeCardText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength)
}

export function isCardTheme(value: unknown): value is CardTheme {
  return typeof value === 'string' && Object.hasOwn(cardThemes, value)
}

export function isCardConfig(value: unknown): value is CardConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<CardConfig>
  return typeof config.relationship === 'string'
    && (config.language === 'en' || config.language === 'bn')
    && typeof config.openingLine === 'string'
    && typeof config.letter === 'string'
    && Array.isArray(config.reasons)
    && config.reasons.length >= 3
    && config.reasons.length <= 6
    && config.reasons.every(reason => typeof reason === 'string')
    && typeof config.finalWish === 'string'
    && Array.isArray(config.photos)
    && config.photos.length <= 6
    && config.photos.every(photo => !!photo && typeof photo.url === 'string' && typeof photo.caption === 'string')
    && (config.songId === 'none' || config.songId === 'custom')
}
