declare module 'mammoth/mammoth.browser.js' {
  interface RawTextResult {
    value: string
    messages: Array<{ type: 'warning' | 'error'; message: string }>
  }

  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<RawTextResult>
  }

  export default mammoth
}
