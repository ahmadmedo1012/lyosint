/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  readonly BASE_PATH?: string;
  readonly PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
