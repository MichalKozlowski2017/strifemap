/**
 * Cheap pre-OpenAI triage: drop | news | extract.
 * Most RSS items should never reach the model.
 */
import { relevanceScore } from "@/lib/sources/relevance";

export type TriageDecision = "drop" | "news" | "extract";

const LOCATION_CUES = [
  /\b(kyiv|kiev|kharkiv|odesa|odessa|zaporizh|donetsk|luhansk|crimea|black sea)\b/i,
  /\b(gaza|rafah|beirut|tel aviv|jerusalem|damascus|tehran|hormuz|red sea|yemen|houthi)\b/i,
  /\b(sudan|sahel|darfur|mogadishu|niger|mali|burkina)\b/i,
  /\b(taiwan|south china sea|korean peninsula|pyongyang|manila)\b/i,
  /\b(baltic|kaliningrad|poland|warsaw|suwalki|nord stream)\b/i,
  /\b(near|outside|over|in|at)\s+[A-ZÁÉÍÓÚĄĆĘŁŃÓŚŹŻ][\w\-']+/,
  /\b\d{1,2}\.\d+\s*[NS],?\s*\d{1,3}\.\d+\s*[EW]\b/,
];

export function hasLocationCue(title: string, body: string | null): boolean {
  const text = `${title}\n${(body ?? "").slice(0, 800)}`;
  return LOCATION_CUES.some((re) => re.test(text));
}

export function triageItem(input: {
  title: string;
  body: string | null;
  trustWeight: number;
  theaterSlug: string | null;
}): { decision: TriageDecision; score: number; location: boolean } {
  const score = relevanceScore(input.title, input.body);
  const location = hasLocationCue(input.title, input.body);
  const trust = Number.isFinite(input.trustWeight) ? input.trustWeight : 1;

  // Weak / unrelated → never spend tokens
  if (score < 2) {
    return { decision: "drop", score, location };
  }
  if (score < 3 && trust < 0.95) {
    return { decision: "drop", score, location };
  }

  // Map-candidate: strong conflict signal + place cue + decent trust
  if (location && score >= 2 && trust >= 1.0) {
    return { decision: "extract", score, location };
  }
  // Very strong keyword hit even without place → still worth extract attempt
  if (score >= 4 && trust >= 1.1) {
    return { decision: "extract", score, location };
  }

  // Conflict-relevant but not map-ready → news path (no OpenAI)
  if (score >= 2 && trust >= 0.9) {
    return { decision: "news", score, location };
  }

  return { decision: "drop", score, location };
}

/** Infer theater from source mapping or keyword hints (no API). */
export function inferTheaterSlug(
  title: string,
  body: string | null,
  suggested: string | null,
): string {
  if (suggested) return suggested;
  const text = `${title}\n${body ?? ""}`;
  if (/\b(ukraine|russia|kyiv|kharkiv|donbas|crimea|black sea)\b/i.test(text)) {
    return "ukraine-russia";
  }
  if (/\b(gaza|israel|lebanon|iran|houthi|hormuz|syria|yemen)\b/i.test(text)) {
    return "middle-east";
  }
  if (/\b(sudan|sahel|somalia|congo|ethiopia|niger|mali)\b/i.test(text)) {
    return "africa";
  }
  if (/\b(taiwan|china|korea|indo-pacific|south china sea)\b/i.test(text)) {
    return "indo-pacific";
  }
  if (/\b(baltic|nato|europe|sabotage|poland|germany|france)\b/i.test(text)) {
    return "europe-hybrid";
  }
  if (/\b(venezuela|caribbean|mexico|colombia|brazil)\b/i.test(text)) {
    return "americas";
  }
  return "europe-hybrid";
}
