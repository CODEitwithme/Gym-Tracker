export function assertNonBlank(value: string, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must not be blank.`)
  }
}

export function assertFiniteNonNegative(
  value: number,
  fieldName: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a finite, non-negative number.`)
  }
}

export function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`)
  }
}

export function assertNonNegativeInteger(
  value: number,
  fieldName: string,
): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`)
  }
}

export function assertIsoDateTime(value: string, fieldName: string): void {
  const match =
    typeof value === 'string'
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
          value,
        )
      : null
  const calendarDateIsValid = match
    ? isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
    : false
  if (
    !match ||
    !calendarDateIsValid ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${fieldName} must be a valid ISO 8601 date-time string.`)
  }
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function assertLocalDate(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error('localDate must use YYYY-MM-DD format.')
  }
  const [, year, month, day] = match
  if (!isValidCalendarDate(Number(year), Number(month), Number(day))) {
    throw new Error('localDate must be a valid calendar date.')
  }
}
