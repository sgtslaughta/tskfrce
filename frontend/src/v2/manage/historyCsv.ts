import type { HistoryRow } from '@/v2/types'

const cell = (v: string | number | null): string => {
  let s = v == null ? '' : String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}` // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: HistoryRow[]): string {
  const head = 'date,kid,item,kind,status,points,decided_by,note'
  const lines = rows.map((r) =>
    [r.decided_at ?? r.created_at, r.kid_name, r.name, r.kind, r.auto ? 'auto' : r.status === 'denied' ? 'declined' : 'approved', r.status === 'denied' ? 0 : r.cost, r.decided_by_name, r.note]
      .map(cell)
      .join(','),
  )
  return [head, ...lines].join('\n')
}

export function downloadCsv(name: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
