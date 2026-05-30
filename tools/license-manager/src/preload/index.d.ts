import type { Api } from '../shared/ipc'

declare global {
  interface Window {
    mgr: Api
  }
}

export {}
