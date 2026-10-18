import type { UUID } from '../types/records'

export function createUUID(): UUID {
  const randomUUID = globalThis.crypto?.randomUUID
  if (!randomUUID) {
    throw new Error('A secure crypto.randomUUID() implementation is required.')
  }
  return randomUUID.call(globalThis.crypto)
}

export function createTimestamp(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot create a timestamp from an invalid date.')
  }
  return date.toISOString()
}

export function formatLocalDate(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot format an invalid date.')
  }
  const year = date.getFullYear()
  const formattedYear = String(year).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${formattedYear}-${month}-${day}`
}
