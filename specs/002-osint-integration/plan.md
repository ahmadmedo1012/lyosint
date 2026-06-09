# خطة تكامل OSINT الكاملة — LYOSINT

> **الهدف**: دمج أدوات OSINT مفتوحة المصدر لتغطية **username** (صور/بايو/روابط) و**phone** (بيانات كاملة) بدقة قصوى، مع **subdomain خارج الأولوية**، و**0 أخطاء**، و**0 تداخل**.

---

## الرؤية (Architecture)

```
pserv واحد على Render
├── Node.js 20 (Express API + SPA static)
└── Python 3.11 (subprocess) ← المرحلة 2 فقط
    └── maigret (MIT) عبر maigret_runner.py
        └── reads config from stdin, writes JSON to stdout
```

**pserv واحد**، **لا Compose**، **لا sidecar**. Python يُحقن في نفس Docker image عبر multi-stage.

---

## الترخيص (License Audit)

| أداة | رخصة | قرار | السبب |
|---|---|---|---|
| WhatsMyName (wmn-data.json) | CC BY-SA 4.0 | ✅ | attribution فقط |
| libphonenumber-js | Apache-2.0 | ✅ | Google's open source |
| Maigret v0.6.1 | MIT | ✅ | مجاني تجارياً |
| Holehe | GPL-3.0 | ❌ | تَخطَّى (متطلبات copyleft) |
| PhoneInfoga | GPL-3.0 | ❌ | تَخطَّى (متوقّف) |
| GHunt | غير محدد | ❌ | تَخطَّى (يحتاج Google auth) |
| theHarvester | MIT | ❌ | تَخطَّى (subdomain غير أولوية) |
| Amass | Apache-2.0 | ❌ | تَخطَّى (subdomain غير أولوية) |

---

## المرحلة 1 — WhatsMyName JSON + libphonenumber (بلا Python)

### 1.1 إضافة libphonenumber-js

**ملف**: `artifacts/api-server/package.json`

```diff
   "dependencies": {
     "@workspace/api-zod": "workspace:*",
     "@workspace/db": "workspace:*",
     "cookie-parser": "^1.4.7",
     "cors": "^2.8.6",
     "drizzle-orm": "catalog:",
     "express": "^5.2.1",
+    "libphonenumber-js": "^1.11.20",
     "pino": "^9.14.0",
     "pino-http": "^10.5.0"
   }
```

**تحقق**: `pnpm install` في sandbox، ثم تأكد من `artifacts/api-server/node_modules/libphonenumber-js/metadata.full.json` (~158kB، **لا يوجد image impact** لأنه pure-JS بدون native binding).

### 1.2 إنشاء خدمة libphonenumber

**ملف جديد**: `artifacts/api-server/src/services/phoneHelpers.ts`

**الواجهة**:
```ts
export interface PhoneMeta {
  valid: boolean;
  e164: string | null;
  nationalNumber: string | null;
  country: string | null;        // "LY", "US", ...
  countryCallingCode: string | null;
  numberType: string | null;     // "MOBILE" | "FIXED_LINE" | "VOIP" | ...
  isPossible: boolean;
  isValid: boolean;
  internationalFormat: string | null;
  nationalFormat: string | null;
}
export function getPhoneMeta(rawPhone: string): PhoneMeta;
export function isLikelyMobile(phone: string): boolean;
```

**السلوك**:
- يستدعي `parsePhoneNumberFromString(phone)` + `isValidPhoneNumber(phone)`.
- يرجع `null` لكل الحقول عند الفشل (لا يرمي exception).
- لا يفترض country افتراضي (لأن الرقم قادم من المستخدم، فإذا لم يُكتشف نُعيد null).
- **ملاحظة**: libphonenumber-js **لا يعرف** Libyan carriers (الـ metadata لا يغطي LY prefix mapping). لذلك نُبقي `libyaHelpers.ts` كما هو ونستخدم libphonenumber كـ **complement** للتحقق الدولي + country detection + format.

### 1.3 تعديل phoneSearch.ts

**ملف**: `artifacts/api-server/src/services/phoneSearch.ts`

**التغييرات** (الحفاظ على backward compat):
- استيراد `getPhoneMeta` من `phoneHelpers`.
- إضافة `getPhoneMeta(phone)` كأولوية أولى (قبل Numverify).
- في الـ `phoneResult`:
  - `countryName`: `numverifyData?.countryName ?? phoneMeta.country ?? null` (mapped: LY→"Libya", ...).
  - `countryCode`: `phoneMeta.country ?? isLibyan ? "LY" : null`.
  - `lineType`: `phoneMeta.numberType?.toLowerCase() ?? (numverifyData?.lineType ?? "mobile")`.
  - `nationalFormat`: `phoneMeta.nationalFormat ?? formatNational(phone)`.
  - حقول جديدة (اختيارية): `phoneMeta: phoneMeta`.
- الـ `dataSource` يصبح: `"numverify+libphonenumber+local"` أو `"libphonenumber+local"` أو `"local-rules"`.

**لا تغيير في API contract الخارجي** — فقط enrichment. الحقول الحالية كلها محفوظة.

### 1.4 تنزيل wmn-data.json

**ملف جديد**: `artifacts/api-server/src/data/wmn-data.json`

- يُنزَّل من `https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json`.
- حجم: ~600kB، 732 موقع.
- يُحمَّل lazy في `whatsmyname.ts` (caching في module-level var).
- **لا يُكتب لـ DB** (ما يلزمش، load-time ~50ms).

### 1.5 إنشاء خدمة WhatsMyName

**ملف جديد**: `artifacts/api-server/src/services/whatsmyname.ts`

**الواجهة**:
```ts
export interface WMNResult {
  siteName: string;
  category: string;
  uri: string;
  e_code: number;    // HTTP status when found
  m_code: number;    // HTTP status when missing
  found: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  error?: string;
}

export interface WMNSite {
  name: string;
  uri_check: string;
  uri_pretty?: string;
  e_code: number;
  e_string?: string;
  m_code: number;
  m_string?: string;
  cat: string;
  // (rest optional)
}

export function loadWMNData(): WMNSite[];

export async function checkWhatsMyName(
  username: string,
  options?: { concurrency?: number; perSiteTimeoutMs?: number; siteNames?: string[]; }
): Promise<WMNResult[]>;
```

**السلوك**:
- يقرأ `wmn-data.json` من `data/wmn-data.json` (lazy + cache).
- يبني `URL(uri_check.replace('{account}', encodeURIComponent(username)))` لكل site.
- يفعل fetch مع timeout 8s لكل site.
- يحدد found عبر:
  - إذا `httpStatus === site.e_code` → found.
  - إذا `httpStatus === site.m_code` → not found.
  - حالات خاصة: `e_code === 200 && m_code === 200` → نفحص `e_string` و `m_string` (case-insensitive contains) في body.
- يحدّ `concurrency = 20` (افتراضي) لتفادي rate limits.
- **يعالج site failures** بـ try/catch (بعض المواقع ترمي DNS errors أو anti-bot).
- يرجع array من `WMNResult`، يحذف `error` فقط (لا يحذف found=false).

### 1.6 تعديل usernameSearch.ts

**ملف**: `artifacts/api-server/src/services/usernameSearch.ts`

**التغييرات** (الحفاظ على backward compat):
- استيراد `checkWhatsMyName, loadWMNData`.
- استدعاء `checkWhatsMyName(username)` في `Promise.allSettled` مع `checkUsername` و `lookupTwitchUser`.
- تجميع `wmnResults` كـ `PlatformResult[]` (تحويل WMNResult → PlatformResult shape):
  - `slug = wmn.siteName.toLowerCase().replace(/\s+/g, '-')`
  - `url = wmn.uri` (يحلّ `{account}` → username)
  - `status = wmn.found ? "found" : "not_found"`
  - `verified = true` (WhatsMyName صارم في claims)
  - `profileData = {}` (WhatsMyName لا يستخرج bio/avatar، فقط existence check)
- **دمج** `results` و `wmnResults` قبل بناء `profilesFound`:
  - GitHub: `wmnResults` يتداخل مع `checkUsername` → نُبقي `checkUsername` entry، نُلحق `wmnResults` (لأن WMN عنده YouTube, Instagram, TikTok, etc. الـ checkUsername لا يغطيها).
  - **Conflict resolution**: GitHub نأخذه من `checkUsername` (أسرع وأغنى لأنه يربط GitHub API)، الباقي نأخذه من `wmnResults`.
- تحديث `totalPlatformsSearched = wmnResults.length + httpChecker.length` (تقريباً 732 + 50 = 782).
- تحديث `totalFound`, `verifiedFound`, `confidence` من الـ merged set.

**ضمان 0 تداخل**: الـ slugs مختلفة بين `checkUsername` (github, twitter, instagram, ...) و `wmnResults` (WMN categories names). نضيف de-duplication: لو نفس الـ slug موجود في الاثنين، نُبقي `checkUsername` (لأنه enriched).

### 1.7 تحديث openapi.yaml

**ملف**: `lib/api-spec/openapi.yaml`

**تغييرات** (additive فقط):
- في `PhoneResult` (السطر 362-393)، إضافة:
  ```yaml
  phoneMeta:
    type: ["object", "null"]
    $ref: "#/components/schemas/PhoneMeta"
  ```
- في `UsernameResult` (السطر 435-468)، إضافة:
  ```yaml
  sources:
    type: array
    items: { type: string }
  profilePhoto:
    type: ["string", "null"]
  profileBio:
    type: ["string", "null"]
  profileFullname:
    type: ["string", "null"]
  ```
- schemas جديدة:
  - `PhoneMeta` (matches `PhoneMeta` interface في phoneHelpers).
  - `MaigretProfile` (للمرحلة 2).

**ملاحظة**: عند إضافة `sources: []` نضع "wmn" كأحد الـ values الممكنة.

### 1.8 إعادة توليد api-zod

**أمر**:
```bash
cd lib/api-spec && pnpm run orval
```
(إذا لم يوجد، نضيفه في package.json: `"orval": "orval --config orval.config.ts"`).

**التحقق**:
- `lib/api-zod/src/generated/types/phoneMeta.ts` موجود.
- `lib/api-zod/src/generated/types/usernameResult.ts` فيه `sources`, `profilePhoto`, `profileBio`, `profileFullname`.
- `pnpm --filter @workspace/api-zod run build` يعيد بناء dist.

### 1.9 تحديث frontend search-result.tsx

**ملف**: `artifacts/lyosint/src/pages/search-result.tsx`

**التغييرات** (additive فقط):
- في قسم phone result (نبحث عن `phoneResult.countryName`):
  - إضافة badge يعرض `phoneResult.phoneMeta?.numberType` (mobile/voip/...).
  - عرض country flag (اختياري) بجانب `countryName`.
- في قسم username result:
  - إذا `usernameResult.profilePhoto` موجود، عرض avatar في `CardHeader`.
  - إذا `usernameResult.profileBio` موجود، عرض بايو في `CardContent`.
  - إذا `usernameResult.profileFullname` موجود، عرض في الـ header.
  - إضافة `sources` chips.

**ضمان backward compat**: جميع الحقول optional (`type: ["string", "null"]`)، الـ frontend يستخدم optional chaining + fallback.

### 1.10 اختبار + build + نشر

```bash
# 1. install
pnpm install
# 2. regenerate zod
cd lib/api-spec && pnpm run orval && cd -
# 3. typecheck
pnpm -r run typecheck
# 4. build
pnpm run build
# 5. dry-run locally (if possible)
pnpm --filter @workspace/api-server run dev
# 6. commit
git add -A
git commit -m "feat(osint): integrate WhatsMyName (732 sites) + libphonenumber"
git push  # auto-deploy
# 7. test live
curl -X POST https://lyosint.onrender.com/api/search/username -H "Content-Type: application/json" \
  -d '{"username":"github"}' 
```

### 1.11 عتبات النجاح (Phase 1 acceptance)

- ✅ `pnpm -r run typecheck` → 0 errors.
- ✅ `pnpm run build` → 0 errors.
- ✅ Docker build succeeds (~no size change, libphonenumber-js is pure JS).
- ✅ Live test: `username="github"` يعيد `totalPlatformsSearched ≥ 700` و`totalFound ≥ 30`.
- ✅ Live test: `phone="+218912345678"` يعيد `phoneMeta.country === "LY"`, `phoneMeta.numberType === null` (Libya not in metadata, OK).
- ✅ Live test: `phone="+447911123456"` يعيد `phoneMeta.numberType === "MOBILE"`.
- ✅ لا 500 errors.

---

## المرحلة 2 — Maigret عبر Python (subprocess)

### 2.1 كتابة maigret_runner.py

**ملف جديد**: `scripts/maigret_runner.py` (يذهب إلى Docker image root).

**المواصفات**:
- يقرأ JSON config من stdin:
  ```json
  {"username": "test", "top_sites": 500, "timeout": 10, "max_connections": 50, "parse": true}
  ```
- ينفّذ `asyncio.run(run_maigret(config))`.
- يكتب JSON result إلى stdout (single line, parseable).
- **stderr**: warning messages (not JSON).
- Timeout داخلي: `top_sites * timeout * 1.5` كحد أقصى (لا يتجاوز 180 ثانية).

**الـ output schema** (هذا مهم للـ TS wrapper):
```json
{
  "username": "test",
  "elapsed_seconds": 67.34,
  "total_checked": 500,
  "found_count": 12,
  "found": [
    {
      "site": "YouTube",
      "url": "https://www.youtube.com/@test/about",
      "http_status": 200,
      "rank": 3,
      "profile": {
        "image": "https://yt3...",
        "fullname": "test",
        "bio": "...",
        "youtube_channel_id": "UCDAM...",
        "is_family_safe": true
      },
      "linked_usernames": {"Test": "username"},
      "linked_links": ["https://example.com"]
    }
  ]
}
```

**Strategy** (الـ Python code):
```python
import asyncio, json, sys, time, os, maigret
from maigret import MaigretDatabase
from maigret.checking import maigret as maigret_search

async def run(config):
    username = config["username"]
    top = int(config.get("top_sites", 500))
    timeout = int(config.get("timeout", 10))
    maxc = int(config.get("max_connections", 50))
    parse = bool(config.get("parse", True))
    
    db = MaigretDatabase()
    db.load_from_path(os.path.join(os.path.dirname(maigret.__file__), 'resources', 'data.json'))
    sites = db.ranked_sites_dict(top)
    
    logger = logging.getLogger("maigret")
    logger.setLevel(logging.WARNING)
    
    start = time.time()
    results = await maigret_search(
        username=username, site_dict=sites, logger=logger,
        timeout=timeout, is_parsing_enabled=parse,
        max_connections=maxc, no_progressbar=True,
    )
    elapsed = round(time.time() - start, 2)
    
    found = []
    for site, r in results.items():
        if not isinstance(r, dict): continue
        st = r.get("status")
        if not hasattr(st, "status"): continue
        if st.status.name != "CLAIMED": continue
        ids = getattr(st, "ids_data", {}) or {}
        found.append({
            "site": site,
            "url": r.get("url_user") or r.get("url_main"),
            "http_status": r.get("http_status"),
            "rank": r.get("rank"),
            "profile": {k: v for k, v in ids.items() if k in {
                "image","fullname","bio","uid","username","location","created_at",
                "follower_count","following_count","youtube_channel_id","channel_url",
                "is_verified","tiktok_id","sec_uid","tiktok_username","videos",
                "is_family_safe","country","image_bg","videos_count",
                "is_secret","heart_count","video_count","digg_count",
                "isVerified","twitter_verified","id","blog_url","is_employee",
                "is_looking_for_job","is_beta_user","is_twitter_verified",
                "hearts_count","periscope_username",
            }},
            "linked_usernames": r.get("ids_usernames", {}),
            "linked_links": r.get("ids_links", []),
        })
    
    return {
        "username": username,
        "elapsed_seconds": elapsed,
        "total_checked": len(results),
        "found_count": len(found),
        "found": found,
    }
```

**لماذا هذا التصميم؟**
- `is_parsing_enabled=True` يعطي `ids_data` على `result["status"].ids_data` (مُختبر محلياً).
- `status.status.name === "CLAIMED"` هو الفلتر الصحيح (مُختبر).
- الـ progress logs تذهب لـ stderr (لا تختلط مع JSON في stdout).
- لا حلقات على stderr/stdout لأن Maigret يستخدم `logger.warning` (Python logging) → stderr.
- **ضمان**: في v0.6.1 الـ progress الـ progressbar يطبع لـ stdout بشكل ANSI art، لكن `--no-progressbar=True` (default في المكتبة) يُلغيه. تأكدنا في sandbox.

### 2.2 تحديث Dockerfile (multi-stage)

**ملف**: `Dockerfile` (الحالي 4 stages).

**التصميم الجديد** (5 stages):

```dockerfile
# Stage 1: base
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Stage 2: deps (Node.js deps)
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* tsconfig.json tsconfig.base.json ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
RUN apk add --no-cache python3 py3-pip
RUN pnpm install --frozen-lockfile=false

# Stage 3: python-deps (install Maigret)
FROM deps AS python-deps
RUN pip install --no-cache-dir --break-system-packages maigret[all]==0.6.1
# Verify
RUN python3 -c "import maigret; print(maigret.__version__)"

# Stage 4: build
FROM deps AS build
COPY --from=deps /app /app
RUN pnpm run build

# Stage 5: api (runtime)
FROM deps AS api
ENV NODE_ENV=production
ENV PORT=10000
ENV PYTHONUNBUFFERED=1
COPY --from=python-deps /usr/lib/python3*/site-packages /usr/lib/python3*/site-packages
COPY --from=python-deps /usr/local/lib/python3*/site-packages /usr/local/lib/python3*/site-packages
COPY --from=python-deps /usr/bin/maigret /usr/bin/maigret
COPY --from=build /app /app
# Copy the Maigret runner script
COPY scripts/maigret_runner.py /app/maigret_runner.py
RUN chmod +x /app/maigret_runner.py
WORKDIR /app
EXPOSE 10000
CMD ["pnpm", "run", "render:start"]
```

**Image size impact**:
- maigret + deps: ~150-200MB
- python3 + py3-pip: ~80MB (in base)
- **Total**: ~250MB increase (final image: ~700-800MB).

**ضمان**: Render free plan يدعم 1GB images، paid يدعم أكبر. **بدون cost impact** على Free plan.

### 2.3 إنشاء maigret.ts service

**ملف جديد**: `artifacts/api-server/src/services/maigret.ts`

**الواجهة**:
```ts
export interface MaigretProfile {
  image?: string;
  fullname?: string;
  bio?: string;
  uid?: string;
  username?: string;
  location?: string;
  created_at?: string;
  follower_count?: string | number;
  following_count?: string | number;
  youtube_channel_id?: string;
  channel_url?: string;
  is_verified?: boolean | string;
  // ... (rest)
}

export interface MaigretFound {
  site: string;
  url: string;
  http_status: number | null;
  rank: number | null;
  profile: MaigretProfile;
  linked_usernames: Record<string, string>;
  linked_links: string[];
}

export interface MaigretResult {
  username: string;
  elapsed_seconds: number;
  total_checked: number;
  found_count: number;
  found: MaigretFound[];
}

export interface MaigretOptions {
  topSites?: number;       // default 500
  timeoutSec?: number;     // default 10
  maxConnections?: number; // default 50
  parse?: boolean;         // default true
  overallTimeoutMs?: number; // default 180_000
}

export async function runMaigret(
  username: string,
  options?: MaigretOptions
): Promise<MaigretResult | null>;
```

**السلوك** (Node.js subprocess):
- يتحقق من وجود `python3` + `maigret` (cached feature detection).
- يبني config JSON.
- ينفّذ `child_process.spawn('python3', ['/app/maigret_runner.py'])`:
  - stdin: `JSON.stringify({username, top_sites, timeout, max_connections, parse})`
  - stdout: accumulated buffer → parse JSON.
  - stderr: ignore (debug-only).
- يحدد `overallTimeoutMs = options.overallTimeoutMs ?? 180_000` (180s default).
- **on timeout**: `child.kill('SIGTERM')` بعد 175s، ثم `SIGKILL` بعد 5s.
- يرجع `null` عند الفشل (لا يرمي exception إلى caller).

**تصميم الـ integration مع usernameSearch.ts**:

في `usernameSearch.ts`:
- نُضيف `runMaigret(username, {topSites: 500, overallTimeoutMs: 180_000})` كـ **Promise في parallel** مع `checkWhatsMyName` و `checkUsername` و `lookupTwitchUser`.
- نضع progress update عند 50% (Maigret هو الأبطأ، نُحدّث progress أثناء انتظاره).
- بعد ما يكتمل، ندمج `found` array مع `profilesFound`:
  - `slug = maigret.site.toLowerCase().replace(/\s+/g, '-')`
  - `url = maigret.url`
  - `status = "found"`
  - `verified = true` (Maigret صارم)
  - `profileData = maigret.profile`
  - `bio = maigret.profile.bio ?? null`
  - `displayName = maigret.profile.fullname ?? null`
  - `confidence = "high"`
- نختار **أفضل avatar/bio** للـ `profilePhoto` / `profileBio` / `profileFullname`:
  - من YouTube → YouTube (إذا موجود).
  - وإلا → GitHub.
  - وإلا → أعلى `rank` من أي موقع.

**ضمان 0 تداخل**:
- `profilesFound[r.slug]` dict-keyed: لا يمكن لـ slug مكرر. GitHub slug يأتي من `checkUsername` (الأول)، WMN و Maigret يحاولان إضافته → overwrite by key: نُبقي `checkUsername` (لأنه enriched بـ GitHub API data).
- ترتيب الـ merge: `checkUsername` → `whatsmyname` → `maigret`. Maigret هو الأخير → له الأولوية في الـ overwrite.
- **لكن** للـ profile photos/bios، نختار **الأول** الموجود (لا overwrite).

### 2.4 تحديث openapi.yaml (additions)

في `UsernameResult` (السطر 435):
- إضافة `profilePhoto, profileBio, profileFullname` (لـ frontend).
- إضافة `sources: [string]`.
- إضافة `maigretSources?: [string]` (قائمة المواقع من Maigret).

في `PlatformProfile` (السطر 555):
- إضافة `avatar: string | null`.
- إضافة `bio: string | null` (موجود أصلاً).
- إضافة `fullname: string | null`.
- إضافة `location: string | null`.
- إضافة `rawData: object | null` (كل ids_data من Maigret).

### 2.5 إعادة توليد api-zod

نفس الخطوة 1.8.

### 2.6 تحديث frontend

في `search-result.tsx` (نفس المنطق من 1.9):
- إذا `profilePhoto` موجود: عرض avatar (دائرة، 64x64) في الـ header.
- إذا `profileBio` موجود: عرض بايو في CardContent.
- إذا `profileFullname` موجود: عرض كـ displayName.
- إذا `maigretSources.length > 0`: عرض chips للمنصات الرئيسية (YouTube, GitHub, etc.).

### 2.7 تحديث .dockerignore

**ملف**: `.dockerignore` (يوجد حالياً). نُضيف:
```
# Don't bundle the (large) data files into the Docker build context
# They will be downloaded at runtime by Maigret
artifacts/api-server/src/data/
scripts/maigret_runner.py
```

**تصحيح**: `maigret_runner.py` **يجب** أن يُنسخ. نُعدّل:
- `artifacts/api-server/src/data/` → ignore (wmn-data.json ينزل في build stage من GitHub).
- `scripts/maigret_runner.py` → **لا** ignore (نحتاجه في runtime).

### 2.8 اختبار + build + نشر

```bash
# 1. validate Python wrapper locally
cd /tmp && python3 -c "
import json, sys
sys.path.insert(0, '<repo>/scripts')
import asyncio
import maigret_runner  # this won't work, copy file first
"
# 2. docker build (if Docker available)
docker build -t lyosint-test .
docker run -p 10000:10000 -e NODE_ENV=production lyosint-test
# 3. test
curl -X POST http://localhost:10000/api/search/username -d '{"username":"github"}'
# 4. commit + push
git add -A
git commit -m "feat(osint): integrate Maigret via Python subprocess for rich profile data"
git push
# 5. monitor Render deploy
```

### 2.9 عتبات النجاح (Phase 2 acceptance)

- ✅ `pnpm -r run typecheck` → 0 errors.
- ✅ Docker build succeeds locally (if Docker available; otherwise rely on Render logs).
- ✅ Render deploy logs show: `python3 -c "import maigret; print(maigret.__version__)"` → `0.6.1`.
- ✅ Live test: `username="github"` يعيد:
  - `totalFound ≥ 100` (WMN 732 + httpChecker 50 + Maigret 500 = many).
  - `profilePhoto !== null` (GitHub avatar).
  - `profileBio === "How people build software."`.
  - `profileFullname === "GitHub"`.
  - `maigretSources.includes("YouTube")` (أو `["YouTube", "Twitter", ...]`).
- ✅ Live test: `username="john_doe_random_xyz"` يعيد (لا تعقيدات، معظمها "not found").
- ✅ لا 500 errors.
- ✅ لا memory leaks (subprocess killed على timeout).

---

## معالجة الأخطاء و Safety Nets

### في كل مرحلة:
1. **Try/catch** حول كل OSINT service.
2. **Graceful degradation**: إذا فشلت خدمة، نُكمل بالباقي.
3. **Timeout** على كل HTTP/subprocess call.
4. **No secret leaks** (env vars في logs مُمحاة عبر pino redact).
5. **No user-controlled file paths** (wmn-data.json hardcoded path).
6. **Subprocess cleanup**: `child.kill('SIGTERM')` على timeout + cleanup interval.
7. **DB rollback**: إذا فشل merge، الـ search يبقى `failed` status ولا يبقى `running` للأبد.

### Defensive TypeScript:
- كل حقل OSINT optional في TS interface → `string | null | undefined`.
- `??` fallback في كل مكان في frontend.
- `?.` optional chaining.
- Zod schemas تستخدم `.nullable()` و `.optional()`.

### Defensive Python (maigret_runner.py):
- `try/except` حول `maigret_search()` → يرجع `{"error": "..."}` JSON.
- `sys.exit(1)` عند الفشل → Node يكتشف non-zero exit.
- **No print to stdout** غير الـ JSON النهائي.

---

## خطة الاختبار التدريجي (Acceptance Tests)

| مرحلة | اختبار | متوقع |
|---|---|---|
| 1 | `pnpm -r run typecheck` | 0 errors |
| 1 | `pnpm run build` | 0 errors |
| 1 | Live: `POST /api/search/phone {"phone":"+218912345678"}` | `phoneMeta.country === "LY"`, `phoneResult.valid === true` |
| 1 | Live: `POST /api/search/phone {"phone":"+447911123456"}` | `phoneMeta.numberType === "MOBILE"` |
| 1 | Live: `POST /api/search/phone {"phone":"+33123456789"}` | `phoneMeta.country === "FR"`, `phoneMeta.countryCallingCode === "33"` |
| 1 | Live: `POST /api/search/username {"username":"github"}` | `totalFound ≥ 30`, `totalPlatformsSearched ≥ 700` |
| 1 | Live: `POST /api/search/username {"username":"ahmed_test_random"}` | `totalFound ≤ 5`, لا error |
| 2 | Docker build | succeeds, image size ~800MB |
| 2 | Render logs | `maigret 0.6.1` مثبت |
| 2 | Live: `POST /api/search/username {"username":"github"}` | `profilePhoto !== null`, `profileBio !== null` |
| 2 | Live: `usernameSearch` completes in < 120s | لا timeout |
| 2 | Live: maigret subprocess killed على timeout | لا process leak |
| 2 | Live: Maigret progress في logs (stderr) | `Bot protection error`, `Access denied` تظهر |
| 2 | Live: `elapsed_seconds` في response | `> 30s` (Maigret بطيء) |

---

## ملاحظات نهائية

### Concurrent processing
- `checkWhatsMyName` (concurrency 20) + `checkUsername` (concurrency 10) + `runMaigret` (subprocess).
- كل واحد مستقل → 3 promises في `Promise.allSettled`.
- **لا race conditions** لأن كل واحد يبني `profilesFound` slug-keyed، والـ merge sequential.

### Rate limiting
- WMN: 20 concurrent, 8s timeout → ~80 req/s max.
- Maigret: 50 concurrent, 10s timeout → ~5 req/s avg (bottleneck is server response).
- httpChecker: 10 concurrent → ~20 req/s.
- **لا rate limiting violations** متوقعة (WMN sites usually allow 100+ req/s).

### Render resource usage
- **CPU**: Render free plan = shared 0.1 vCPU. Maigret subprocess يستهلك ~30% CPU. مقبول.
- **Memory**: 512MB free plan. Maigret ~150MB + Node ~150MB + OS ~100MB = ~400MB peak. **مقبول**.
- **Egress**: 100GB/month free. كل search يستهلك ~5MB (HTTP requests). ~20K searches/month. **مقبول**.

### Rollback strategy
- إذا فشل Phase 1 → revert commit (Render يدعم).
- إذا فشل Phase 2 → revert + disable `runMaigret` في TS (env var `MAIGRET_ENABLED=false` flag).
- **لا data corruption risk** (DB schema لم يتغير).

### Future enhancements (خارج النطاق)
- Holehe (GPL) - يحتاج relicense.
- PhoneInfoga (GPL) - متوقف.
- theHarvester (MIT) - subdomain recon.
- Amass (Apache-2.0) - subdomain recon.
- Email → phone reverse lookup.
- Social media verification via OAuth.

---

## التبعيات الإضافية (Dependencies)

### Phase 1
- `libphonenumber-js` (npm, 80kB-160kB)
- `wmn-data.json` (600kB bundled)

### Phase 2
- `python3` (~80MB image)
- `maigret[all]==0.6.1` (~150MB image)
- `scripts/maigret_runner.py` (~3kB)

**Total bundle increase**:
- Phase 1: ~750kB.
- Phase 2: ~250MB (image).
- DB: لا تغيير.

---

## الخلاصة

**خطة كاملة** تدمج OSINT بدقة **0 أخطاء** و**0 تداخل**:
- WhatsMyName (732 موقع) → fallback existence checks.
- Maigret (3000+ موقع) → rich profile data (avatar, bio, fullname).
- libphonenumber-js → phone validation + country + line type.
- الـ pserv واحد على Render → لا sidecar، لا Compose.
- **تغييرات additive** فقط في OpenAPI/TS/Frontend → backward compatible.
- **defensive programming** في كل مكان.
- **اختبار تدريجي** مع عتبات نجاح واضحة.

**جاهز للتطبيق بانتظار أمرك.**
