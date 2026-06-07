import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── API Key Services ────────────────────────────────────────────────────────
export const API_KEY_SERVICES = [
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
    name: "Twitch Client ID",
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
  {
    key: "ipinfo_token",
    name: "IPInfo",
    category: "network",
    description: "بيانات تفصيلية عن عناوين IP: الموقع، مزود الخدمة، ASN — مجاني 50,000 طلب/شهر",
    url: "https://ipinfo.io/account/token",
    scope: "IP lookup, Geolocation",
    freeLimit: "50,000 طلب/شهر مجاني",
  },
  {
    key: "abstractapi_email_key",
    name: "AbstractAPI Email",
    category: "email",
    description: "التحقق من صحة عناوين البريد الإلكتروني واكتشاف المؤقتة منها",
    url: "https://app.abstractapi.com/api/email-validation/",
    scope: "Email validation",
    freeLimit: "100 طلب/شهر مجاني",
  },
  {
    key: "emailrep_key",
    name: "EmailRep.io",
    category: "email",
    description: "سمعة البريد الإلكتروني: هل هو مشبوه، مؤقت، أو مرتبط بنشاط ضار",
    url: "https://emailrep.io/key",
    scope: "Email reputation",
    freeLimit: "1000 طلب/يوم مجاني",
  },
  {
    key: "leakcheck_key",
    name: "LeakCheck.io",
    category: "breach",
    description: "البحث في قواعد بيانات التسريبات: البريد الإلكتروني، اسم المستخدم، كلمة المرور المجزأة",
    url: "https://leakcheck.io/register",
    scope: "Breach DB lookup",
    freeLimit: "محدود مجاني",
  },
];

// ─── System Config Definitions ───────────────────────────────────────────────
export const SYSTEM_CONFIG_DEFS = [
  {
    key: "sys_free_search_quota",
    name: "حصة البحث المجانية",
    description: "عدد عمليات البحث المسموح بها للمستخدمين المجانيين",
    defaultValue: "3",
    type: "number",
    min: 0,
    max: 100,
  },
  {
    key: "sys_subscription_days",
    name: "مدة الاشتراك (أيام)",
    description: "المدة الافتراضية للاشتراك عند منحه يدوياً",
    defaultValue: "30",
    type: "number",
    min: 1,
    max: 3650,
  },
  {
    key: "sys_max_concurrent_searches",
    name: "الحد الأقصى للبحث المتزامن",
    description: "أقصى عدد من عمليات البحث المتزامنة لكل مستخدم",
    defaultValue: "3",
    type: "number",
    min: 1,
    max: 20,
  },
  {
    key: "sys_platform_check_timeout",
    name: "مهلة فحص المنصات (ثانية)",
    description: "الوقت الأقصى لانتظار رد كل منصة أثناء فحص اليوزرنيم",
    defaultValue: "5",
    type: "number",
    min: 2,
    max: 30,
  },
  {
    key: "sys_site_name",
    name: "اسم الموقع",
    description: "الاسم المعروض في لوحة التحكم والتقارير",
    defaultValue: "LYOSINT",
    type: "text",
  },
  {
    key: "sys_maintenance_mode",
    name: "وضع الصيانة",
    description: "عند التفعيل، يُحجب وصول المستخدمين العاديين مع إبقاء لوحة التحكم مفتوحة",
    defaultValue: "false",
    type: "boolean",
  },
];

// ─── All defined settings (union) ────────────────────────────────────────────
export const DEFINED_SERVICES = API_KEY_SERVICES;

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

export async function getSystemConfig(key: string): Promise<string | null> {
  const def = SYSTEM_CONFIG_DEFS.find((d) => d.key === key);
  if (!def) return null;
  const val = await getSetting(key);
  return val ?? def.defaultValue;
}

export async function getSystemConfigNumber(key: string): Promise<number> {
  const val = await getSystemConfig(key);
  return parseInt(val ?? "0", 10) || 0;
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
