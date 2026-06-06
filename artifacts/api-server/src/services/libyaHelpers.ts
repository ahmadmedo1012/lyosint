export const LIBYA_CARRIER_PREFIXES: Record<string, string> = {
  "091": "Al-Madar",
  "093": "Al-Madar",
  "092": "Libyana",
  "094": "Libyana",
  "095": "LibyaPhone",
  "096": "LibyaPhone",
};

export const LIBYA_REGION_PREFIXES: Record<string, string> = {
  "091": "Tripoli Region",
  "093": "Western Libya",
  "092": "Eastern Libya",
  "094": "Southern Libya",
  "095": "Central Libya",
  "096": "Benghazi Region",
};

export const LIBYA_SOCIAL_PLATFORMS = [
  "facebook", "instagram", "twitter", "tiktok", "telegram",
  "youtube", "snapchat", "linkedin",
];

export function normalizeLibyaPhone(raw: string): string {
  const cleaned = raw.replace(/\s|-|\(|\)/g, "");
  if (cleaned.startsWith("+218")) return cleaned;
  if (cleaned.startsWith("00218")) return "+218" + cleaned.slice(5);
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+218" + cleaned.slice(1);
  if (/^[0-9]{10}$/.test(cleaned)) return "+218" + cleaned.slice(1);
  return cleaned;
}

export function libyaCarrierFromPhone(phone: string): string | null {
  const local = phone.startsWith("+218") ? "0" + phone.slice(4) : phone;
  const prefix = local.slice(0, 3);
  return LIBYA_CARRIER_PREFIXES[prefix] ?? null;
}

export function libyaRegionFromPhone(phone: string): string | null {
  const local = phone.startsWith("+218") ? "0" + phone.slice(4) : phone;
  const prefix = local.slice(0, 3);
  return LIBYA_REGION_PREFIXES[prefix] ?? "Libya";
}

export function generateNameVariants(arabicOrEnglishName: string): string[] {
  const parts = arabicOrEnglishName.trim().split(/\s+/);
  const variants: string[] = [];

  const isArabic = /[\u0600-\u06FF]/.test(arabicOrEnglishName);

  if (isArabic) {
    const translitMap: Record<string, string[]> = {
      "علي": ["Ali", "Aly"],
      "محمد": ["Mohamed", "Muhammad", "Mohammad"],
      "أحمد": ["Ahmed", "Ahmad"],
      "عمر": ["Omar", "Umar"],
      "المبروك": ["Mabrouk", "Mabrook", "Elmabrouk", "Almabrouk"],
      "الشريف": ["Sherif", "Elsherif", "Alshareef"],
      "الطرابلسي": ["Trabelsi", "Eltarabelsi"],
      "الفيتوري": ["Elfitori", "Fitori"],
      "الورفلي": ["Werفali", "Alwarfali"],
    };
    const englishParts = parts.map((p) => translitMap[p]?.[0] ?? p);
    variants.push(englishParts.join(" "));
    if (englishParts.length > 1) {
      variants.push(`${englishParts[0]} ${englishParts[englishParts.length - 1]}`);
    }
  } else {
    if (parts.length > 2) {
      variants.push(`${parts[0]} ${parts[parts.length - 1]}`);
    }
    variants.push(parts.join(".").toLowerCase());
    variants.push(parts.join("_").toLowerCase());
  }

  return [...new Set(variants.filter((v) => v !== arabicOrEnglishName))];
}
