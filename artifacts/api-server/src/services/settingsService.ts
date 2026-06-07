import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Defined Services (all available API integrations) ───────────────────────
export const DEFINED_SERVICES = [
  {
    key: "github_token",
    name: "GitHub",
    category: "developer",
    description: "Personal Access Token — يرفع حد الطلبات من 60 إلى 5000/ساعة ويتيح البحث المتقدم في المستودعات والمستخدمين",
    url: "https://github.com/settings/tokens/new",
    scope: "read:user, read:org (اختياري)",
    freeLimit: "60 طلب/ساعة بدون token",
  },
  {
    key: "hunter_api_key",
    name: "Hunter.io",
    category: "email",
    description: "اكتشاف عناوين البريد الإلكتروني المرتبطة بالأسماء والشركات",
    url: "https://hunter.io/api-keys",
    scope: "Email Finder",
    freeLimit: "25 بحث مجاني/شهر",
  },
  {
    key: "hibp_api_key",
    name: "Have I Been Pwned",
    category: "breach",
    description: "فحص ما إذا كان البريد الإلكتروني أو اسم المستخدم قد ظهر في تسريبات بيانات",
    url: "https://haveibeenpwned.com/API/Key",
    scope: "Breach search",
    freeLimit: "مدفوع ($3.50/شهر)",
  },
  {
    key: "shodan_api_key",
    name: "Shodan",
    category: "network",
    description: "استخبارات الشبكات: الأجهزة المكشوفة، المنافذ المفتوحة، الخدمات المرتبطة بالأهداف",
    url: "https://account.shodan.io/",
    scope: "Search, Host info",
    freeLimit: "مجاني محدود",
  },
  {
    key: "numverify_api_key",
    name: "Numverify",
    category: "phone",
    description: "التحقق من أرقام الهاتف دولياً: الحامل، النوع (موبايل/ثابت)، الدولة",
    url: "https://numverify.com/product",
    scope: "Phone validation",
    freeLimit: "100 طلب/شهر مجاني",
  },
  {
    key: "virustotal_api_key",
    name: "VirusTotal",
    category: "threat",
    description: "فحص الروابط، النطاقات، وعناوين IP للتهديدات والمحتوى الخبيث",
    url: "https://www.virustotal.com/gui/user/apikey",
    scope: "URL, Domain, IP analysis",
    freeLimit: "500 طلب/يوم مجاني",
  },
  {
    key: "twitch_client_id",
    name: "Twitch",
    category: "social",
    description: "التحقق من وجود المستخدم على Twitch وجلب إحصائيات القناة",
    url: "https://dev.twitch.tv/console/apps",
    scope: "Helix API",
    freeLimit: "مجاني مع تسجيل التطبيق",
  },
  {
    key: "twitch_client_secret",
    name: "Twitch Client Secret",
    category: "social",
    description: "سر العميل المرافق لـ Twitch Client ID",
    url: "https://dev.twitch.tv/console/apps",
    scope: "App Secret",
    freeLimit: "مجاني",
  },
];

// ─── In-memory cache ──────────────────────────────────────────────────────────
const cache = new Map<string, string>();
let lastRefresh = 0;
const CACHE_TTL = 30_000; // 30 seconds

async function refreshIfStale() {
  if (Date.now() - lastRefresh < CACHE_TTL) return;
  try {
    const rows = await db.select().from(settingsTable);
    cache.clear();
    for (const row of rows) {
      if (row.value != null) cache.set(row.key, row.value);
    }
    lastRefresh = Date.now();
  } catch {
    // table might not exist yet during boot — ignore
    lastRefresh = Date.now();
  }
}

export function invalidateCache() {
  lastRefresh = 0;
}

export async function getSetting(key: string): Promise<string | null> {
  await refreshIfStale();
  return cache.get(key) ?? null;
}

export async function getAllSettingRows() {
  try {
    return db.select().from(settingsTable);
  } catch {
    return [];
  }
}

export async function setSetting(key: string, value: string | null) {
  await db
    .insert(settingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
  invalidateCache();
}

export async function deleteSetting(key: string) {
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
  invalidateCache();
}
