import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { libyaCarrierFromPhone, libyaRegionFromPhone, normalizeLibyaPhone } from "./libyaHelpers";
import { validatePhone } from "./freeApis";
import { getPhoneMeta, getCountryName, type PhoneMeta } from "./phoneHelpers";

export async function runPhoneSearch(id: string, rawPhone: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running", progress: 5 }).where(eq(searchesTable.id, id));

    const phone = normalizeLibyaPhone(rawPhone);
    const isLibyan = phone.startsWith("+218");

    // ── Parallel: libphonenumber + Numverify API ────────────────────────────
    const [phoneMeta, numverifyData] = await Promise.all([
      Promise.resolve().then(() => getPhoneMeta(phone)),
      validatePhone(phone).catch(() => null),
    ]);

    const valid = phoneMeta.valid || /^\+218[0-9]{9}$/.test(phone);

    // ── Carrier & region (Libyan prefix rules, computed in memory) ──────────
    const carrier = isLibyan ? libyaCarrierFromPhone(phone) : null;
    const region = isLibyan ? libyaRegionFromPhone(phone) : null;
    const nationalFormat = phoneMeta.nationalFormat ?? (valid ? formatNational(phone) : null);

    // ── Generate investigative links (instant) ──────────────────────────────
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

    // ── Country code/name ──────────────────────────────────────────────────
    const detectedCountryCode = phoneMeta.country ?? null;
    const detectedCountryName = getCountryName(detectedCountryCode) ?? numverifyData?.countryName ?? (isLibyan ? "Libya" : null);

    // ── Line type ──────────────────────────────────────────────────────────────
    const libpnLineType = phoneMeta.numberType
      ? phoneMeta.numberType.toLowerCase()
      : null;
    const lineType = libpnLineType ?? numverifyData?.lineType ?? (valid ? "mobile" : "unknown");

    // ── Confidence ─────────────────────────────────────────────────────────
    let confidence = 0.15;
    if (valid) confidence += 0.25;
    if (isLibyan && carrier) confidence += 0.2;
    if (region) confidence += 0.1;
    if (numverifyData?.valid) confidence += 0.2;
    if (phoneMeta.valid && phoneMeta.country) confidence += 0.1;
    if (libpnLineType) confidence += 0.05;
    confidence = Math.round(Math.min(confidence, 0.95) * 100) / 100;

    const sources: string[] = [];
    if (phoneMeta.valid) sources.push("libphonenumber");
    if (numverifyData?.valid) sources.push("numverify");
    if (isLibyan) sources.push("local-rules");
    const dataSource = sources.length > 0 ? sources.join("+") : "local-rules";

    const resultsCount = (valid ? 1 : 0) + (carrier ? 1 : 0) + investigativeLinks.length;

    // ── Single DB write ────────────────────────────────────────────────────
    await db.update(searchesTable).set({
      status: "completed", progress: 100,
      platformsSearched: 6,
      phoneResult: {
        phone,
        valid,
        nationalFormat,
        isLibyan,
        carrier: numverifyData?.carrier ?? carrier,
        lineType,
        region: numverifyData?.location ?? region,
        countryName: detectedCountryName,
        countryCode: numverifyData?.countryCode ?? detectedCountryCode ?? (isLibyan ? "LY" : null),
        investigativeLinks,
        messagingApps: {
          whatsapp: { available: null, url: `https://wa.me/${phone.replace("+", "")}`, note: "تحقق يدوياً" },
          telegram: { available: null, url: `https://t.me/${phone.replace("+", "")}`, note: "تحقق يدوياً" },
        },
        dataSource,
        confidenceScore: confidence,
        phoneMeta: {
          valid: phoneMeta.valid,
          possible: phoneMeta.possible,
          e164: phoneMeta.e164,
          nationalNumber: phoneMeta.nationalNumber,
          country: phoneMeta.country,
          countryCallingCode: phoneMeta.countryCallingCode,
          numberType: phoneMeta.numberType,
          internationalFormat: phoneMeta.internationalFormat,
          nationalFormat: phoneMeta.nationalFormat,
        },
      },
      confidenceScore: confidence,
      resultsCount, completedAt: new Date(),
    }).where(eq(searchesTable.id, id));
  } catch {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}

function formatNational(phone: string): string | null {
  if (phone.startsWith("+218")) {
    const local = "0" + phone.slice(4);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phone;
}
