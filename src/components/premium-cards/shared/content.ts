export type BirthdayCardContent = {
  recipientName: string
  senderName?: string
  age?: string
  date?: string
  message?: string
  photo?: string
  musicChoice?: 'signature' | 'soft' | 'off'
}

export function formatBirthdayDate(value: string, language: 'en' | 'bn') {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function safePhotoUrl(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value, 'https://wishwell.invalid')
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.origin === 'https://wishwell.invalid' ? `${url.pathname}${url.search}${url.hash}` : url.href
  } catch {
    return undefined
  }
}
