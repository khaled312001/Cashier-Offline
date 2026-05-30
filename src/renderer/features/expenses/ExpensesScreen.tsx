import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { formatMoney, toPiasters, formatDate } from '../../lib/format'

interface Expense { id: number; category: string | null; amount: number; description: string | null; paymentMethod: string | null; userName: string | null; createdAt: number }

const CATEGORIES = ['إيجار', 'كهرباء', 'مرتبات', 'صيانة', 'مشتريات', 'نقل', 'أخرى']

export function ExpensesScreen() {
  const [list, setList] = useState<Expense[]>([])
  const [summary, setSummary] = useState<{ total: number; byCategory: Array<{ category: string; total: number }> } | null>(null)
  const [form, setForm] = useState({ category: 'أخرى', amount: '', description: '' })

  const reload = async () => {
    const to = Date.now()
    const from = to - 30 * 86_400_000
    setList((await window.api.expenses.list({ from, to, limit: 200 })) as Expense[])
    setSummary(await window.api.expenses.summary({ from, to }))
  }
  useEffect(() => {
    reload()
  }, [])

  const add = async () => {
    if (!form.amount) return
    await window.api.shift.addExpense({ category: form.category, amount: toPiasters(Number(form.amount)), description: form.description })
    setForm({ category: 'أخرى', amount: '', description: '' })
    reload()
  }

  return (
    <div className="grid h-full grid-cols-[1fr_360px] gap-4 p-6">
      <div className="flex flex-col">
        <h1 className="mb-1 text-2xl font-extrabold text-ink-800">المصروفات</h1>
        <p className="mb-4 text-sm text-ink-400">مصروفات آخر 30 يومًا</p>
        <div className="card flex-1 overflow-auto">
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 bg-ink-50 text-ink-500">
              <tr><th className="p-3 text-start font-semibold">الفئة</th><th className="p-3 text-start font-semibold">البيان</th><th className="p-3 text-start font-semibold">المبلغ</th><th className="p-3 text-start font-semibold">بواسطة</th><th className="p-3 text-start font-semibold">التاريخ</th></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                  <td className="p-3"><span className="chip bg-ink-100 text-ink-600">{e.category}</span></td>
                  <td className="p-3 text-ink-700">{e.description}</td>
                  <td className="p-3 font-bold text-rose-600">{formatMoney(e.amount)}</td>
                  <td className="p-3 text-ink-400">{e.userName}</td>
                  <td className="p-3 text-ink-400">{formatDate(e.createdAt)}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-ink-400">لا توجد مصروفات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-800"><Icon name="plus" className="h-5 w-5 text-brand-600" /> مصروف جديد</h2>
          <label className="label">الفئة</label>
          <select className="input mb-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <label className="label">المبلغ</label>
          <input className="input mb-3 text-center text-xl" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <label className="label">البيان</label>
          <input className="input mb-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn-primary w-full" onClick={add} disabled={!form.amount}>إضافة</button>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-bold text-ink-800">الملخص (30 يوم)</h2>
          <div className="mb-3 rounded-xl bg-rose-50 p-3 text-center">
            <div className="text-sm text-rose-600">إجمالي المصروفات</div>
            <div className="text-2xl font-extrabold text-rose-700">{formatMoney(summary?.total ?? 0, true)}</div>
          </div>
          <div className="space-y-1.5 text-sm">
            {summary?.byCategory.map((c) => (
              <div key={c.category} className="flex justify-between rounded-lg bg-ink-50 px-3 py-2">
                <span className="text-ink-600">{c.category}</span>
                <span className="font-bold text-ink-800">{formatMoney(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
