import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "./logger";

interface Secrets {
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  DATABASE_URL: string;
  REDIS_URL?: string;
  JWT_REFRESH_SECRET?: string;
  TOTP_ISSUER?: string;
  HCAPTCHA_SECRET?: string;
  TURNSTILE_SECRET?: string;
}

const REQUIRED_SECRETS: (keyof Secrets)[] = ["JWT_SECRET", "ENCRYPTION_KEY", "DATABASE_URL"];
const OPTIONAL_SECRETS: (keyof Secrets)[] = [
  "REDIS_URL", "JWT_REFRESH_SECRET", "TOTP_ISSUER",
  "HCAPTCHA_SECRET", "TURNSTILE_SECRET",
];

function loadEnvFile(): Record<string, string> {
  const envPaths = [
    resolve(import.meta.dirname, "../../.env"),
    resolve(import.meta.dirname, "../../../.env"),
    resolve(process.cwd(), ".env"),
  ];

  for (const filePath of envPaths) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const vars: Record<string, string> = {};
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx === -1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          let value = trimmed.slice(eqIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (key) vars[key] = value;
        }
        return vars;
      } catch {
        break;
      }
    }
  }
  return {};
}

const envFile = loadEnvFile();

function getSecret(key: keyof Secrets): string | undefined {
  return process.env[key] ?? envFile[key];
}

function validateRequired(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_SECRETS) {
    const value = getSecret(key);
    if (!value) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `الأسماء الأسرارية الإجبارية مفقودة: ${missing.join(", ")}. `
      + "تأكد من تعيينها في المتغيرات البيئية أو ملف .env",
    );
  }
}

function warnOptional(): void {
  for (const key of OPTIONAL_SECRETS) {
    if (!getSecret(key)) {
      logger.warn({ secret: key }, `السر الاختياري ${key} غير مضبوط — بعض الميزات قد لا تعمل`);
    }
  }
}

function requireSecret(key: keyof Secrets): string {
  const value = getSecret(key);
  if (!value) {
    throw new Error(`السر الإجباري ${key} غير مضبوط — تأكد من تعيينه في المتغيرات البيئية أو ملف .env`);
  }
  return value;
}

export const secrets: Secrets = {
  get JWT_SECRET() { return requireSecret("JWT_SECRET"); },
  get ENCRYPTION_KEY() { return requireSecret("ENCRYPTION_KEY"); },
  get DATABASE_URL() { return requireSecret("DATABASE_URL"); },
  get REDIS_URL() { return getSecret("REDIS_URL"); },
  get JWT_REFRESH_SECRET() { return getSecret("JWT_REFRESH_SECRET"); },
  get TOTP_ISSUER() { return getSecret("TOTP_ISSUER"); },
  get HCAPTCHA_SECRET() { return getSecret("HCAPTCHA_SECRET"); },
  get TURNSTILE_SECRET() { return getSecret("TURNSTILE_SECRET"); },
};

export function initSecrets(): void {
  validateRequired();
  warnOptional();
  logger.info("تم التحقق من جميع الأسماء الأسرارية");
}
