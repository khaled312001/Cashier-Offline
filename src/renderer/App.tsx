import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './stores/authStore'
import { useSettings } from './stores/settingsStore'
import { useLicense } from './stores/licenseStore'
import { useShift } from './stores/shiftStore'
import { Activation } from './features/license/Activation'
import { Login } from './features/auth/Login'
import { MainLayout } from './layout/MainLayout'
import { PosScreen } from './features/pos/PosScreen'
import { FloorPlan } from './features/tables/FloorPlan'
import { ProductsScreen } from './features/products/ProductsScreen'
import { InventoryScreen } from './features/inventory/InventoryScreen'
import { StocktakeScreen } from './features/inventory/StocktakeScreen'
import { CustomersScreen } from './features/customers/CustomersScreen'
import { SuppliersScreen } from './features/suppliers/SuppliersScreen'
import { PurchasesScreen } from './features/purchases/PurchasesScreen'
import { ExpensesScreen } from './features/expenses/ExpensesScreen'
import { SalesHistoryScreen } from './features/sales/SalesHistoryScreen'
import { UsersScreen } from './features/users/UsersScreen'
import { ReportsScreen } from './features/reports/ReportsScreen'
import { ShiftScreen } from './features/shift/ShiftScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { BackupScreen } from './features/backup/BackupScreen'

export default function App() {
  const auth = useAuth()
  const settings = useSettings()
  const license = useLicense()
  const shift = useShift()
  const [booted, setBooted] = useState(false)
  const [licenseAck, setLicenseAck] = useState(false)

  useEffect(() => {
    Promise.all([settings.load(), license.refresh(), auth.refresh()]).finally(() => setBooted(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (auth.user) shift.refresh()
  }, [auth.user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!booted || !settings.loaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-100 text-ink-400">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-brand-600" />
        <span>جاري التحميل...</span>
      </div>
    )
  }

  // License gate
  if (!license.canSell() && !licenseAck) {
    return <Activation onActivated={() => setLicenseAck(true)} />
  }

  // Auth gate
  if (!auth.user) {
    return <Login />
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="/pos" element={<PosScreen />} />
          <Route path="/tables" element={<FloorPlan />} />
          <Route path="/sales" element={<SalesHistoryScreen />} />
          <Route path="/products" element={<ProductsScreen />} />
          <Route path="/inventory" element={<InventoryScreen />} />
          <Route path="/stocktake" element={<StocktakeScreen />} />
          <Route path="/purchases" element={<PurchasesScreen />} />
          <Route path="/suppliers" element={<SuppliersScreen />} />
          <Route path="/customers" element={<CustomersScreen />} />
          <Route path="/expenses" element={<ExpensesScreen />} />
          <Route path="/reports" element={<ReportsScreen />} />
          <Route path="/shift" element={<ShiftScreen />} />
          <Route path="/users" element={<UsersScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/backup" element={<BackupScreen />} />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
