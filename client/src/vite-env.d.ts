/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_RPC: string;
  readonly VITE_TEE_RPC: string;
  readonly VITE_PROGRAM_ID: string;
  readonly VITE_VALIDATOR: string;
  readonly VITE_ORACLE_QUEUE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
