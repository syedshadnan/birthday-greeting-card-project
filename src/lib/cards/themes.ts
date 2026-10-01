export const cardThemes = {
  'royal-gold': { label: 'Royal gold', className: 'theme-royal' },
  'rose-romantic': { label: 'Rose romantic', className: 'theme-rose' },
  'midnight-galaxy': { label: 'Midnight galaxy', className: 'theme-midnight' },
  'pastel-cute': { label: 'Pastel cute', className: 'theme-pastel' },
  cute: { label: 'Cute', className: 'theme-peach' },
  friend: { label: 'Best friend', className: 'theme-sky' },
  elegant: { label: 'Elegant', className: 'theme-elegant' },
  funny: { label: 'Funny', className: 'theme-lime' },
  minimal: { label: 'Minimal', className: 'theme-minimal' },
  cinematic: { label: 'Cinematic', className: 'theme-cinematic' },
  party: { label: 'Birthday party', className: 'theme-party' },
  'magical-gift': { label: 'Magical gift box', className: 'theme-gift' },
  'cake-celebration': { label: 'Cake celebration', className: 'theme-cake' },
  'cute-cartoon': { label: 'Cute cartoon', className: 'theme-cartoon' },
  'polaroid-memory': { label: 'Polaroid memory', className: 'theme-polaroid' },
  'interactive-story': { label: 'Interactive story', className: 'theme-adventure' },
  'cute-animal': { label: 'Cute animal', className: 'theme-animal' },
  'floral-birthday': { label: 'Floral birthday', className: 'theme-floral' },
  'surprise-reveal': { label: 'Surprise reveal', className: 'theme-reveal' },
  'cinematic-birthday': { label: 'Cinematic birthday', className: 'theme-cinema' },
} as const

export type CardTheme = keyof typeof cardThemes
export const classicCardThemeChoices: CardTheme[] = [
  'cute',
  'rose-romantic',
  'friend',
  'elegant',
  'funny',
  'minimal',
  'cinematic',
  'party',
]
export type CardLanguage = 'en' | 'bn'
export const cardLetterMaxLength = 1200

export type CardConfig = {
  relationship: string
  language: CardLanguage
  openingLine: string
  letter: string
  reasons: string[]
  keepsakeNote: string
  finalWish: string
  age?: string
  date?: string
  nickname?: string
  quote?: string
  closingLine?: string
  musicChoice?: 'signature' | 'soft'
  memories?: { date: string; text: string }[]
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
    && config.reasons.length <= 8
    && config.reasons.every(reason => typeof reason === 'string')
    && typeof config.keepsakeNote === 'string'
    && typeof config.finalWish === 'string'
    && (config.age === undefined || typeof config.age === 'string')
    && (config.date === undefined || typeof config.date === 'string')
    && (config.nickname === undefined || typeof config.nickname === 'string')
    && (config.quote === undefined || typeof config.quote === 'string')
    && (config.closingLine === undefined || typeof config.closingLine === 'string')
    && (config.musicChoice === undefined || config.musicChoice === 'signature' || config.musicChoice === 'soft')
    && (config.memories === undefined || (
      Array.isArray(config.memories)
      && config.memories.length <= 8
      && config.memories.every(memory => !!memory && typeof memory.date === 'string' && typeof memory.text === 'string')
    ))
    && Array.isArray(config.photos)
    && config.photos.length <= 8
    && config.photos.every(photo => !!photo && typeof photo.url === 'string' && typeof photo.caption === 'string')
    && (config.songId === 'none' || config.songId === 'custom')
}
