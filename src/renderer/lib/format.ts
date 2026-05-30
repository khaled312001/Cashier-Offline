export { formatMoney, toPiasters, toPounds } from '@shared/money'

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
