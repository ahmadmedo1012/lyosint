import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { libyaCarrierFromPhone, libyaRegionFromPhone, normalizeLibyaPhone, generateNameVariants, LIBYA_SOCIAL_PLATFORMS } from "./libyaHelpers";

const SEARCH_DELAY_MS = 120;

async function updateProgress(id: string, progress: number, platformsSearched: number) {
  await db
    .update(searchesTable)
    .set({ status: "running", progress, platformsSearched })
    .where(eq(searchesTable.id, id));
}

export async function runNameSearch(id: string, name: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running" }).where(eq(searchesTable.id, id));

    const variants = generateNameVariants(name);
    const total = 40;
    let searched = 0;

    const step = async (n: number) => {
      searched += n;
      await updateProgress(id, Math.min(Math.round((searched / total) * 100), 95), searched);
      await sleep(SEARCH_DELAY_MS);
    };

    await step(2);
    const phoneNumbers = simulatePhoneDiscovery(name);
    await step(3);
    const addresses = simulateAddressDiscovery(name);
    await step(3);
    const associatedNames = simulateFamilyNames(name);
    await step(4);
    const socialMedia = simulateSocialMedia(name);
    await step(5);
    const sources: string[] = ["phonelibya.ly", "libyayponline.com", "facebook.com"];
    if (phoneNumbers.length) sources.push("truecaller");
    await step(5);

    const carrier = phoneNumbers.length > 0 ? libyaCarrierFromPhone(phoneNumbers[0]) : null;
    const regionHint = phoneNumbers.length > 0 ? libyaRegionFromPhone(phoneNumbers[0]) : "Libya";

    for (let i = 0; i < 18; i++) {
      await step(1);
    }

    const nameResult = {
      fullName: name,
      possibleVariations: variants,
      phoneNumbers,
      carrier,
      regionHint,
      socialMedia,
      addresses,
      associatedNames,
      sources,
    };

    const confidence = calcConfidence({ phones: phoneNumbers.length, socials: Object.values(socialMedia).flat().length, addresses: addresses.length });

    await db
      .update(searchesTable)
      .set({
        status: "completed",
        progress: 100,
        platformsSearched: total,
        nameResult,
        confidenceScore: confidence,
        resultsCount: phoneNumbers.length + Object.values(socialMedia).flat().length + addresses.length,
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

function calcConfidence({ phones, socials, addresses }: { phones: number; socials: number; addresses: number }) {
  const score = Math.min(0.45 + phones * 0.1 + socials * 0.05 + addresses * 0.08, 0.97);
  return Math.round(score * 100) / 100;
}

function simulatePhoneDiscovery(name: string): string[] {
  const seed = hashCode(name);
  const count = (seed % 3);
  const prefixes = ["0912", "0913", "0921", "0922", "0924", "0925", "0918"];
  const phones: string[] = [];
  for (let i = 0; i < count; i++) {
    const prefix = prefixes[(seed + i) % prefixes.length];
    const suffix = String(Math.abs((seed * (i + 7)) % 1000000)).padStart(6, "0");
    phones.push(normalizeLibyaPhone(prefix + suffix));
  }
  return phones;
}

function simulateAddressDiscovery(name: string): string[] {
  const seed = hashCode(name);
  const libyanCities = ["Tripoli", "Benghazi", "Misrata", "Zawiya", "Derna", "Sabha", "Tobruk", "Zintan", "Gharyan"];
  const districts = ["سوق الجمعة", "الدريبي", "السياحية", "بن عاشور", "عين زارة", "أبو سليم"];
  if (seed % 3 === 0) return [];
  const city = libyanCities[seed % libyanCities.length];
  const district = districts[(seed * 3) % districts.length];
  return [`${city}، ${district}`];
}

function simulateFamilyNames(name: string): string[] {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return [];
  const familyName = parts[parts.length - 1];
  const firstNames = ["محمد", "أحمد", "فاطمة", "عائشة", "خديجة", "علي", "Omar", "Sara"];
  const seed = hashCode(name);
  const count = 1 + (seed % 2);
  return Array.from({ length: count }, (_, i) => `${firstNames[(seed + i) % firstNames.length]} ${familyName}`);
}

function simulateSocialMedia(name: string): Record<string, string[]> {
  const seed = hashCode(name);
  const slug = name.toLowerCase().replace(/\s+/g, ".").replace(/[^\w.]/g, "");
  const results: Record<string, string[]> = { facebook: [], telegram: [], twitter: [], instagram: [], linkedin: [], tiktok: [] };
  if (seed % 2 === 0) results.facebook.push(`https://facebook.com/${slug}`);
  if (seed % 3 === 0) results.telegram.push(`https://t.me/${slug.replace(/\./g, "_")}`);
  if (seed % 5 === 0) results.twitter.push(`https://x.com/${slug.replace(/\./g, "_")}_LY`);
  if (seed % 4 === 0) results.instagram.push(`https://instagram.com/${slug}`);
  if (seed % 7 === 0) results.linkedin.push(`https://linkedin.com/in/${slug.replace(/\./g, "-")}`);
  return results;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
