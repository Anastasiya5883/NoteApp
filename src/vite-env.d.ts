/// <reference types="vite/client" />

interface ImportMetaEnv {
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __VB_BACKEND_URL: string
  __VB_EXT_URL: string
}
