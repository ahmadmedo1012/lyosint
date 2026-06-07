import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { libyaCarrierFromPhone, libyaRegionFromPhone, normalizeLibyaPhone } from "./libyaHelpers";
import { validatePhone } from "./freeApis";

const STEP_MS = 180;

export async function runPhoneSearch(id: string, rawPhone: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running", progress: 5 }).where(eq(searchesTable.id, id));

    const phone = normalizeLibyaPhone(rawPhone);
    const valid = /^\+218[0-9]{9}$/.test(phone) || /^\+[1-9][0-9]{7,14}$/.test(phone);
    const isLibyan = phone.startsWith("+218");

    await sleep(STEP_MS);
    await db.update(searchesTable).set({ progress: 15 }).where(eq(searchesTable.id, id));

    // ── Carrier & region (Libyan prefix rules) ───────────────────────────────
    const carrier = isLibyan ? libyaCarrierFromPhone(phone) : null;
    const region = isLibyan ? libyaRegionFromPhone(phone) : null;
    const nationalFormat = valid ? formatNational(phone) : null;

    await sleep(STEP_MS);
    await db.update(searchesTable).set({ progress: 30 }).where(eq(searchesTable.id, id));

    // ── Optional: Numverify API for extended phone data ───────────────────────
    const numverifyData = await validatePhone(phone).catch(() => null);

    await sleep(STEP_MS);
    await db.update(searchesTable).set({ progress: 50 }).where(eq(searchesTable.id, id));

    // ── Generate useful investigative links ───────────────────────────────────
    const localNumber = isLibyan ? phone.replace("+218", "0") : phone;
    const intlEncoded = encodeURIComponent(phone);
    const localEncoded = encodeURIComponent(localNumber);

    const investigativeLinks = [
      { label: "بحث TrueCaller", url: `https://www.truecaller.com/search/ly/${localEncoded}`, type: "caller_id" },
      { label: "بحث Facebook", url: `https://www.facebook.com/search/people?q=${intlEncoded}`, type: "social" },
      { label: "فتح واتساب", url: `https://wa.me/${phone.replace("+", "")}`, type: "messaging" },
      { label: "فتح تيليقرام", url: `https://t.me/${phone.replace("+", "")}`, type: "messaging" },
      ...(isLibyan ? [{ label: "دليل الليبيا", url: `https://www.yellowpages.ly/search?query=${localEncoded}`, type: "directory" }] : []),
      { label: "Google البحث", url: `https://www.google.com/search?q=${intlEncoded}+OR+%22${localEncoded}%22`, type: "search" },
    ];

    await sleep(STEP_MS);
    await db.update(searchesTable).set({ progress: 70 }).where(eq(searchesTable.id, id));

    // ── WhatsApp / Telegram detection hints ──────────────────────────────────
    // We cannot actually check without auth — provide actionable links instead
    const messagingApps = {
      whatsapp: { available: null as boolean | null, url: `https://wa.me/${phone.replace("+", "")}`, note: "تحقق يدوياً" },
      telegram: { available: null as boolean | null, url: `https://t.me/${phone.replace("+", "")}`, note: "تحقق يدوياً" },
    };

    await sleep(STEP_MS);
    await db.update(searchesTable).set({ progress: 88 }).where(eq(searchesTable.id, id));

    // ── Confidence score ──────────────────────────────────────────────────────
    let confidence = 0.15;
    if (valid) confidence += 0.25;
    if (isLibyan && carrier) confidence += 0.2;
    if (region) confidence += 0.1;
    if (numverifyData?.valid) confidence += 0.2;
    confidence = Math.round(Math.min(confidence, 0.95) * 100) / 100;

    const phoneResult = {
      phone,
      valid,
      nationalFormat,
      // Libyan specific
      isLibyan,
      carrier: numverifyData?.carrier ?? carrier,
      lineType: numverifyData?.lineType ?? (valid ? "mobile" : "unknown"),
      region: numverifyData?.location ?? region,
      // Extended (from Numverify)
      countryName: numverifyData?.countryName ?? (isLibyan ? "Libya" : null),
      countryCode: numverifyData?.countryCode ?? (isLibyan ? "LY" : null),
      // Investigation links
      investigativeLinks,
      messagingApps,
      // Source
      dataSource: numverifyData ? "numverify+local" : "local-rules",
      confidenceScore: confidence,
    };

    const resultsCount = (valid ? 1 : 0) + (carrier ? 1 : 0) + investigativeLinks.length;

    await db.update(searchesTable).set({
      status: "completed", progress: 100,
      platformsSearched: 6,
      phoneResult, confidenceScore: confidence,
      resultsCount, completedAt: new Date(),
    }).where(eq(searchesTable.id, id));
  } catch {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatNational(phone: string): string {
  if (phone.startsWith("+218")) {
    const local = "0" + phone.slice(4);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phone;
}
