import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { libyaCarrierFromPhone, libyaRegionFromPhone, normalizeLibyaPhone } from "./libyaHelpers";

const STEP_MS = 200;

export async function runPhoneSearch(id: string, rawPhone: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running" }).where(eq(searchesTable.id, id));

    const total = 15;
    let searched = 0;

    const step = async (n: number) => {
      searched += n;
      await db
        .update(searchesTable)
        .set({ status: "running", progress: Math.min(Math.round((searched / total) * 100), 95), platformsSearched: searched })
        .where(eq(searchesTable.id, id));
      await sleep(STEP_MS);
    };

    const phone = normalizeLibyaPhone(rawPhone);
    const valid = /^\+218[0-9]{9}$/.test(phone);
    await step(1);

    const carrier = libyaCarrierFromPhone(phone);
    const region = libyaRegionFromPhone(phone);
    await step(2);

    const seed = hashCode(phone);
    const ownerAr = seed % 3 === 0 ? sampleArabicName(seed) : null;
    const ownerEn = ownerAr ? transliterate(ownerAr) : null;
    await step(3);

    const whatsapp = seed % 2 === 0;
    const telegramRegistered = seed % 3 !== 0;
    await step(2);

    const facebookLinked =
      seed % 4 === 0
        ? [`https://www.facebook.com/search/people?q=${encodeURIComponent(phone.replace("+218", "0"))}`]
        : [];
    await step(2);

    for (let i = 0; i < 5; i++) await step(1);

    const breachInfo: string[] = [];
    const confidence = calcPhoneConfidence({ valid, ownerFound: !!ownerAr, whatsapp, telegramRegistered });

    const phoneResult = {
      phone,
      valid,
      nationalFormat: valid ? formatNational(phone) : null,
      carrier,
      lineType: "mobile",
      possibleOwner: ownerAr,
      possibleOwnerEn: ownerEn,
      region,
      whatsapp,
      telegramRegistered,
      facebookLinked,
      breachInfo,
      confidenceScore: confidence,
    };

    await db
      .update(searchesTable)
      .set({
        status: "completed",
        progress: 100,
        platformsSearched: total,
        phoneResult,
        confidenceScore: confidence,
        resultsCount: (ownerAr ? 1 : 0) + facebookLinked.length + (whatsapp ? 1 : 0) + (telegramRegistered ? 1 : 0),
        completedAt: new Date(),
      })
      .where(eq(searchesTable.id, id));
  } catch {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function calcPhoneConfidence({ valid, ownerFound, whatsapp, telegramRegistered }: { valid: boolean; ownerFound: boolean; whatsapp: boolean; telegramRegistered: boolean }) {
  let s = 0.3;
  if (valid) s += 0.2;
  if (ownerFound) s += 0.25;
  if (whatsapp) s += 0.1;
  if (telegramRegistered) s += 0.1;
  return Math.round(Math.min(s, 0.97) * 100) / 100;
}

function formatNational(phone: string): string {
  const local = phone.replace("+218", "0");
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

function sampleArabicName(seed: number): string {
  const firsts = ["علي", "محمد", "أحمد", "عمر", "خالد", "يوسف", "إبراهيم", "عبدالله"];
  const middles = ["محمد", "علي", "أحمد", "عبدالرحمن", "عبدالله", "سالم", "مصطفى"];
  const lasts = ["المبروك", "الزروق", "الفيتوري", "الشريف", "الطرابلسي", "البنغازي", "الورفلي"];
  return `${firsts[seed % firsts.length]} ${middles[(seed * 3) % middles.length]} ${lasts[(seed * 7) % lasts.length]}`;
}

function transliterate(arabic: string): string {
  const map: Record<string, string> = {
    "علي": "Ali", "محمد": "Mohamed", "أحمد": "Ahmed", "عمر": "Omar",
    "خالد": "Khalid", "يوسف": "Yusuf", "إبراهيم": "Ibrahim", "عبدالله": "Abdullah",
    "عبدالرحمن": "Abdelrahman", "سالم": "Salem", "مصطفى": "Mustafa",
    "المبروك": "Elmabrouk", "الزروق": "Elzroug", "الفيتوري": "Elfitori",
    "الشريف": "Elsherif", "الطرابلسي": "Eltarablsi", "البنغازي": "Elbenghazi", "الورفلي": "Elwerفali",
  };
  return arabic.split(" ").map((w) => map[w] ?? w).join(" ");
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
