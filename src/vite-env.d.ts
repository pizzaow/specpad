/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL the editor fetches demo content from. Defaults to '/demo/' (prod);
   *  staging builds set '/staging/demo/' so staging is fully self-contained. */
  readonly VITE_DEMO_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
