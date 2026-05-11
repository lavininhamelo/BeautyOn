export function normalizePhoneForStorage(input: string): string {
  const trimmed = input.trim()
  const plus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 8) {
    throw new Error('PHONE_TOO_SHORT')
  }
  return plus ? `+${digits}` : digits
}
