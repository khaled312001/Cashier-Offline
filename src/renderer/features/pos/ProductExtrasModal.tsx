import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { formatMoney } from '../../lib/format'
import type { Product } from '@shared/types'
import type { SelectedModifier } from '../../stores/cartStore'

interface Variant {
  id: number
  name: string
  sellPrice: number | null
}
interface ModItem {
  id: number
  name: string
  price: number
  isDefault: boolean
}
interface ModGroup {
  id: number
  name: string
  minSelect: number
  maxSelect: number
  isRequired: boolean
  modifiers: ModItem[]
}

/**
 * Shown when a product has variants or modifiers. Lets the cashier pick a
 * variant and tick add-ons before the item lands in the cart.
 */
export function ProductExtrasModal({
  product,
  open,
  onClose,
  onConfirm
}: {
  product: Product | null
  open: boolean
  onClose: () => void
  onConfirm: (opts: { variant?: { id: number; name: string; price: number }; modifiers?: SelectedModifier[] }) => void
}) {
  const [variants, setVariants] = useState<Variant[]>([])
  const [groups, setGroups] = useState<ModGroup[]>([])
  const [variantId, setVariantId] = useState<number | null>(null)
  const [picked, setPicked] = useState<Record<number, Set<number>>>({}) // groupId -> set of modifierId

  useEffect(() => {
    if (!product || !open) return
    setVariantId(null)
    setPicked({})
    if (product.hasVariants) window.api.variants.list(product.id).then((v) => setVariants(v as Variant[]))
    else setVariants([])
    if (product.hasModifiers) {
      window.api.modifiers.groupsForProduct(product.id).then((g) => {
        setGroups(g as ModGroup[])
        // preselect defaults
        const init: Record<number, Set<number>> = {}
        for (const grp of g as ModGroup[]) {
          const def = grp.modifiers.filter((m) => m.isDefault).map((m) => m.id)
          if (def.length) init[grp.id] = new Set(def)
        }
        setPicked(init)
      })
    } else setGroups([])
  }, [product, open])

  if (!product) return null

  const toggle = (grp: ModGroup, modId: number) => {
    setPicked((prev) => {
      const set = new Set(prev[grp.id] ?? [])
      if (set.has(modId)) {
        set.delete(modId)
      } else {
        if (grp.maxSelect === 1) set.clear() // single-select acts like radio
        if (grp.maxSelect > 0 && set.size >= grp.maxSelect) return prev // at limit
        set.add(modId)
      }
      return { ...prev, [grp.id]: set }
    })
  }

  const valid = groups.every((g) => {
    const n = (picked[g.id] ?? new Set()).size
    return n >= g.minSelect && (!g.isRequired || n >= 1)
  })

  const confirm = () => {
    const variant = variantId ? variants.find((v) => v.id === variantId) : undefined
    const modifiers: SelectedModifier[] = []
    for (const g of groups) {
      for (const id of picked[g.id] ?? new Set<number>()) {
        const m = g.modifiers.find((x) => x.id === id)
        if (m) modifiers.push({ modifierId: m.id, name: m.name, price: m.price, quantity: 1 })
      }
    }
    onConfirm({
      variant: variant ? { id: variant.id, name: variant.name, price: variant.sellPrice ?? product.sellPrice } : undefined,
      modifiers: modifiers.length ? modifiers : undefined
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={product.name} width="max-w-lg">
      <div className="space-y-4">
        {variants.length > 0 && (
          <div>
            <div className="label">اختر النوع</div>
            <div className="grid grid-cols-2 gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  className={`btn h-11 justify-between ${variantId === v.id ? 'bg-brand-600 text-white' : 'bg-white border border-ink-200 text-ink-700'}`}
                  onClick={() => setVariantId(v.id)}
                >
                  <span>{v.name}</span>
                  <span>{formatMoney(v.sellPrice ?? product.sellPrice)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.id}>
            <div className="mb-1 flex items-center justify-between">
              <span className="label mb-0">{g.name}</span>
              <span className="text-xs text-ink-400">
                {g.isRequired ? 'مطلوب' : 'اختياري'}
                {g.maxSelect > 1 ? ` · حتى ${g.maxSelect}` : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {g.modifiers.map((m) => {
                const on = (picked[g.id] ?? new Set()).has(m.id)
                return (
                  <button
                    key={m.id}
                    className={`btn h-10 justify-between text-sm ${on ? 'bg-brand-600 text-white' : 'bg-white border border-ink-200 text-ink-700'}`}
                    onClick={() => toggle(g, m.id)}
                  >
                    <span>{m.name}</span>
                    {m.price > 0 && <span className="text-xs">+{formatMoney(m.price)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <button className="btn-success w-full" disabled={!valid} onClick={confirm}>
          <Icon name="plus" className="h-5 w-5" /> إضافة للسلة
        </button>
      </div>
    </Modal>
  )
}
