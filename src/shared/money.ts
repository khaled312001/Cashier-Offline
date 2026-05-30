/**
 * Money is stored everywhere as an INTEGER number of piasters (1 EGP = 100 piasters).
 * Never use floating point for money. These helpers convert/format consistently.
 */

export const PIASTERS_PER_POUND = 100

/** Convert pounds (possibly fractional) to integer piasters. */
export function toPiasters(pounds: number): number {
  return Math.round(pounds * PIASTERS_PER_POUND)
}

/** Convert integer piasters to a pounds number (for display/calc only). */
export function toPounds(piasters: number): number {
  return piasters / PIASTERS_PER_POUND
}

/** Format integer piasters as an EGP string, e.g. 12345 -> "123.45". */
export function formatMoney(piasters: number, withSymbol = false): string {
  const sign = piasters < 0 ? '-' : ''
  const abs = Math.abs(piasters)
  const pounds = Math.floor(abs / PIASTERS_PER_POUND)
  const frac = abs % PIASTERS_PER_POUND
  const body = `${sign}${pounds.toLocaleString('en-US')}.${frac.toString().padStart(2, '0')}`
  return withSymbol ? `${body} ج.م` : body
}

/** Tax rate is stored as basis points: 1400 = 14%. */
export function taxFromBasisPoints(amountPiasters: number, bp: number, inclusive: boolean): number {
  if (bp <= 0) return 0
  if (inclusive) {
    // amount already includes tax: tax = amount * bp / (10000 + bp)
    return Math.round((amountPiasters * bp) / (10000 + bp))
  }
  // tax added on top: tax = amount * bp / 10000
  return Math.round((amountPiasters * bp) / 10000)
}

/** Round to nearest piaster step (used for cash rounding settings). */
export function roundTo(piasters: number, step: number): number {
  if (step <= 1) return piasters
  return Math.round(piasters / step) * step
}
