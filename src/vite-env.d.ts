/// <reference types="vite/client" />

/** Forminit SDK (loaded via script from forminit.com) */
interface ForminitClass {
  new (): { submit: (formId: string, formData: FormData) => Promise<{ data?: unknown; error?: { message: string } }> }
}
declare global {
  interface Window {
    Forminit?: ForminitClass
  }
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.png' {
  const src: string
  export default src
}
