import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/format'
import { Icon } from '../../components/Icon'

export function BackupScreen() {
  const { t } = useTranslation()
  const [list, setList] = useState<Array<{ name: string; path: string; size: number; createdAt: number }>>([])
  const [paths, setPaths] = useState<{ userData: string; db: string; backups: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => setList(await window.api.backup.list())
  useEffect(() => {
    reload()
    window.api.app.getPaths().then(setPaths)
  }, [])

  const runNow = async () => {
    setBusy(true)
    try {
      await window.api.backup.runNow()
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const restore = async (path: string) => {
    if (!confirm('سيتم استبدال قاعدة البيانات الحالية بهذه النسخة. متابعة؟')) return
    await window.api.backup.restore(path)
    alert('تم الاسترجاع. سيتم إعادة تشغيل الواجهة.')
    location.reload()
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-800">{t('nav.backup')}</h1>
          <p className="text-sm text-ink-400">حماية بياناتك بنسخ احتياطية محلية</p>
        </div>
        <button className="btn-primary" onClick={runNow} disabled={busy}>
          <Icon name="backup" className="h-4 w-4" />
          نسخة احتياطية الآن
        </button>
      </div>

      {paths && (
        <div className="card mb-4 p-4 text-xs text-ink-500">
          <div className="mb-1">مجلد البيانات: <span dir="ltr" className="font-mono">{paths.userData}</span></div>
          <div>قاعدة البيانات: <span dir="ltr" className="font-mono">{paths.db}</span></div>
        </div>
      )}

      <div className="card overflow-auto">
        <table className="w-full text-start text-sm">
          <thead className="bg-ink-50 text-ink-500">
            <tr>
              <th className="p-3 text-start font-semibold">الملف</th>
              <th className="p-3 text-start font-semibold">التاريخ</th>
              <th className="p-3 text-start font-semibold">الحجم</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.path} className="border-t border-ink-100 hover:bg-ink-50/60">
                <td className="p-3 font-mono text-xs text-ink-700">{b.name}</td>
                <td className="p-3 text-ink-400">{formatDate(b.createdAt)}</td>
                <td className="p-3 text-ink-400">{(b.size / 1024).toFixed(0)} KB</td>
                <td className="p-3 text-end">
                  <button className="btn-ghost h-8 px-3 text-xs" onClick={() => restore(b.path)}>
                    <Icon name="backup" className="h-3.5 w-3.5" />
                    استرجاع
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-ink-400">لا توجد نسخ بعد</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
