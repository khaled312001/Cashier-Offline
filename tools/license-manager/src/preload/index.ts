import { contextBridge, ipcRenderer } from 'electron'
import { CH } from '../shared/ipc'
import type { Api } from '../shared/ipc'
import type { IpcResult } from '../shared/types'

async function inv<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (res.ok) return res.data
  throw new Error(res.error.message)
}

const api: Api = {
  dashboard: () => inv(CH.dashboard),
  products: {
    list: () => inv(CH.productsList),
    upsert: (i) => inv(CH.productsUpsert, i)
  },
  customers: {
    list: () => inv(CH.customersList),
    search: (q) => inv(CH.customersSearch, q),
    upsert: (i) => inv(CH.customersUpsert, i),
    delete: (id) => inv(CH.customersDelete, id)
  },
  licenses: {
    list: (opts) => inv(CH.licensesList, opts),
    forCustomer: (id) => inv(CH.licensesForCustomer, id),
    generate: (i) => inv(CH.licenseGenerate, i),
    renew: (id, opts) => inv(CH.licenseRenew, id, opts),
    revoke: (id) => inv(CH.licenseRevoke, id),
    exportFile: (id) => inv(CH.licenseExportFile, id)
  },
  exportCustomersCsv: () => inv(CH.exportCustomersCsv),
  settings: {
    get: () => inv(CH.settingsGet),
    keygen: () => inv(CH.keygen),
    exportPublicKey: () => inv(CH.exportPublicKey)
  },
  appPaths: () => inv(CH.appPaths)
}

contextBridge.exposeInMainWorld('mgr', api)
