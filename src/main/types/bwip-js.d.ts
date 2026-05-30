declare module 'bwip-js' {
  interface BwipOptions {
    bcid: string
    text: string
    scale?: number
    height?: number
    width?: number
    includetext?: boolean
    textxalign?: string
    [key: string]: unknown
  }
  export function toBuffer(opts: BwipOptions, cb: (err: Error | string, png: Buffer) => void): void
  const _default: { toBuffer: typeof toBuffer }
  export default _default
}
