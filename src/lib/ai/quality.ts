import type { Confidence } from "@/lib/types";

/** Stricter map gate: coords + confidence/source/trust bar. */
export function computeMapEligible(input: {
  confidence: Confidence;
  lat: number | null;
  lng: number | null;
  sourceCount: number;
  trustWeight?: number;
}): boolean {
  if (input.lat == null || input.lng == null) return false;
  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    return false;
  }

  const trust = input.trustWeight ?? 1;
  const sources = input.sourceCount;

  if (input.confidence === "unverified") {
    return sources >= 2 && trust >= 1.0;
  }
  if (input.confidence === "reported") {
    // Single low-trust source stays off the map
    if (sources < 2 && trust < 1.15) return false;
    return true;
  }
  // confirmed: still require some trust or corroboration
  if (sources < 2 && trust < 1.0) return false;
  return true;
}

/**
 * Auto-approve onto the public map when computeMapEligible already passed.
 * Unverified stays pending for panel. Reported/confirmed with coords +
 * trust/source bar become pins (otherwise real days collapse to 0–1 pins).
 * Never auto-sets status to published.
 */
export function autoMapStatus(input: {
  mapEligible: boolean;
  confidence: Confidence;
  sourceCount: number;
  trustWeight: number;
}): "approved" | "pending" {
  if (!input.mapEligible) return "pending";
  if (input.confidence === "unverified") return "pending";
  // mapEligible already enforced trust/source floors for reported/confirmed
  return "approved";
}

/** Public News feed: conflict-relevant non-pins with a minimum trust bar. */
export function passesNewsGate(input: {
  mapEligible: boolean;
  confidence: Confidence;
  sourceCount: number;
  trustWeight: number;
  relevanceOk: boolean;
}): boolean {
  if (input.mapEligible) return false;
  if (!input.relevanceOk) return false;
  if (input.confidence === "unverified") {
    return input.sourceCount >= 2 || input.trustWeight >= 1.1;
  }
  return input.trustWeight >= 0.9 || input.sourceCount >= 2;
}
