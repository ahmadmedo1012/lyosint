import { randomUUID } from "crypto";
import type { EvidenceInput } from "./confidence-engine";

export interface EvidenceItem {
  id: string;
  type: string;
  source: string;
  platform?: string;
  rawValue?: string;
  normalizedValue?: string;
  confidenceScore: number;
  polarity: "supporting" | "conflicting" | "caution";
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export function buildEvidenceFromUsernameResult(
  username: string,
  result: Record<string, unknown>,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const now = new Date();

  const profilesFound = result["profilesFound"] as Record<string, { exists?: boolean; url?: string; displayName?: string; bio?: string; verified?: boolean }> ?? {};
  for (const [platform, profile] of Object.entries(profilesFound)) {
    if (!profile?.exists) continue;
    items.push({
      id: randomUUID(),
      type: "username_exact",
      source: "platform_check",
      platform,
      rawValue: username,
      normalizedValue: username.toLowerCase(),
      confidenceScore: profile.verified ? 0.95 : 0.75,
      polarity: "supporting",
      description: `Username "${username}" found on ${platform}`,
      metadata: { url: profile.url, displayName: profile.displayName },
      timestamp: now,
    });
  }

  const breaches = result["breaches"] as Array<{ name?: string; breachDate?: string }> ?? [];
  for (const breach of breaches) {
    items.push({
      id: randomUUID(),
      type: "data_breach",
      source: "hibp",
      rawValue: breach.name,
      normalizedValue: breach.name?.toLowerCase(),
      confidenceScore: 0.9,
      polarity: "supporting",
      description: `Email associated with breach: ${breach.name}`,
      metadata: breach as Record<string, unknown>,
      timestamp: breach.breachDate ? new Date(breach.breachDate) : now,
    });
  }

  const possibleEmail = result["possibleEmail"] as string | null;
  if (possibleEmail) {
    items.push({
      id: randomUUID(),
      type: "email_match",
      source: "derived",
      rawValue: possibleEmail,
      normalizedValue: possibleEmail.toLowerCase(),
      confidenceScore: 0.6,
      polarity: "supporting",
      description: `Possible email derived: ${possibleEmail}`,
      timestamp: now,
    });
  }

  const certDomains = result["certDomains"] as string[] ?? [];
  for (const domain of certDomains.slice(0, 5)) {
    items.push({
      id: randomUUID(),
      type: "domain_cert",
      source: "crt.sh",
      rawValue: domain,
      normalizedValue: domain.toLowerCase(),
      confidenceScore: 0.7,
      polarity: "supporting",
      description: `Domain certificate found for: ${domain}`,
      timestamp: now,
    });
  }

  return items;
}

export function buildEvidenceFromPhoneResult(
  phone: string,
  result: Record<string, unknown>,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const now = new Date();

  if (result["valid"]) {
    items.push({
      id: randomUUID(),
      type: "phone_verified",
      source: "libphonenumber",
      rawValue: phone,
      normalizedValue: result["e164"] as string ?? phone,
      confidenceScore: 0.95,
      polarity: "supporting",
      description: `Phone number validated: ${result["e164"] ?? phone}`,
      metadata: {
        carrier: result["carrier"],
        country: result["country"],
        lineType: result["lineType"],
      },
      timestamp: now,
    });
  }

  if (result["carrier"]) {
    items.push({
      id: randomUUID(),
      type: "carrier_info",
      source: "phone_intelligence",
      rawValue: result["carrier"] as string,
      normalizedValue: (result["carrier"] as string).toLowerCase(),
      confidenceScore: 0.85,
      polarity: "supporting",
      description: `Carrier identified: ${result["carrier"]}`,
      timestamp: now,
    });
  }

  return items;
}

export function buildEvidenceFromNameResult(
  name: string,
  result: Record<string, unknown>,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const now = new Date();
  const records = result["records"] as Array<Record<string, unknown>> ?? [];

  for (const record of records.slice(0, 10)) {
    items.push({
      id: randomUUID(),
      type: "name_token_overlap",
      source: "name_search",
      rawValue: record["name"] as string ?? name,
      normalizedValue: (record["name"] as string ?? name).toLowerCase(),
      confidenceScore: 0.65,
      polarity: "supporting",
      description: `Name record found: ${record["name"] ?? name}`,
      metadata: record,
      timestamp: now,
    });
  }

  return items;
}

export function evidenceToConfidenceInput(item: EvidenceItem): EvidenceInput {
  return {
    type: item.type,
    weight: item.confidenceScore,
    polarity: item.polarity,
    reliability: item.confidenceScore,
    freshnessDays: Math.floor((Date.now() - item.timestamp.getTime()) / 86400000),
  };
}
