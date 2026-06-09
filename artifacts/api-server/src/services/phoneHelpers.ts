import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  isPossiblePhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

export interface PhoneMeta {
  valid: boolean;
  possible: boolean;
  e164: string | null;
  nationalNumber: string | null;
  country: string | null;
  countryCallingCode: string | null;
  numberType: string | null;
  internationalFormat: string | null;
  nationalFormat: string | null;
}

const COUNTRY_NAMES: Record<string, string> = {
  LY: "Libya",
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  EG: "Egypt",
  TN: "Tunisia",
  DZ: "Algeria",
  MA: "Morocco",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  TR: "Turkey",
  IN: "India",
  PK: "Pakistan",
  RU: "Russia",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  CA: "Canada",
  AU: "Australia",
};

export function getCountryName(code: string | null): string | null {
  if (!code) return null;
  return COUNTRY_NAMES[code] ?? null;
}

export function getPhoneMeta(rawPhone: string): PhoneMeta {
  const empty: PhoneMeta = {
    valid: false,
    possible: false,
    e164: null,
    nationalNumber: null,
    country: null,
    countryCallingCode: null,
    numberType: null,
    internationalFormat: null,
    nationalFormat: null,
  };

  if (!rawPhone || typeof rawPhone !== "string") return empty;

  try {
    const pn = parsePhoneNumberFromString(rawPhone);
    if (!pn) return empty;

    const country = (pn.country ?? null) as CountryCode | null;
    const numberType = pn.getType();
    const valid = pn.isValid();
    const possible = pn.isPossible();

    return {
      valid,
      possible,
      e164: pn.number ?? null,
      nationalNumber: pn.nationalNumber != null ? String(pn.nationalNumber) : null,
      country: country ?? null,
      countryCallingCode: pn.countryCallingCode != null ? String(pn.countryCallingCode) : null,
      numberType: numberType ?? null,
      internationalFormat: typeof pn.formatInternational === "function" ? pn.formatInternational() : null,
      nationalFormat: typeof pn.formatNational === "function" ? pn.formatNational() : null,
    };
  } catch {
    return empty;
  }
}

export function isLikelyMobile(phone: string): boolean {
  const meta = getPhoneMeta(phone);
  return meta.valid && (meta.numberType === "MOBILE" || meta.numberType === "FIXED_LINE_OR_MOBILE");
}

export { isValidPhoneNumber, isPossiblePhoneNumber };
