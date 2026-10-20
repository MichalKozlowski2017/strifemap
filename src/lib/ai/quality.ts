import type { Confidence } from "@/lib/types";

/** Quality gate: unverified without 2+ sources OR missing lat/lng → not map_eligible. */
export function computeMapEligible(input: {
  confidence: Confidence;
  lat: number | null;
  lng: number | null;
  sourceCount: number;
}): boolean {
  if (input.lat == null || input.lng == null) return false;
  if (input.confidence === "unverified" && input.sourceCount < 2) return false;
  return true;
}
