/**
 * Cheap pre-filter before OpenAI extract.
 * Drops lifestyle/sports/celebrity noise; keeps conflict/security signals.
 */

const POSITIVE = [
  /\b(war|warfare|conflict|combat|battle|fighting|clash(es)?)\b/i,
  /\b(airstrike|air strike|missile|drone|uav|shelling|bombard|rocket)\b/i,
  /\b(troop|soldier|military|army|navy|air force|militia|insurgent)\b/i,
  /\b(sabotage|cyberattack|cyber-attack|ddos|hack(ed|ing)?)\b/i,
  /\b(invasion|occupation|offensive|counteroffensive|frontline|front line)\b/i,
  /\b(ceasefire|hostage|prisoner of war|pow|killed|casualt|wounded)\b/i,
  /\b(sanction|embargo|blockade|naval|warship|submarine)\b/i,
  /\b(explosion|blast|attack|bombing|raid)\b/i,
  /\b(gaza|ukraine|israel|hezbollah|hamas|sudan|sahel|taiwan|hormuz)\b/i,
  /\b(nato|pentagon|defence|defense|armed forces)\b/i,
  /\b(wojna|atak|rakiet|dron|front|sabotaż|cyber|żołnier)/i,
];

const NEGATIVE = [
  /\b(football|soccer|nba|mlb|formula 1|f1|tennis|golf|olympic)\b/i,
  /\b(celebrity|hollywood|hollywooding|oscars?|grammy|fashion week)\b/i,
  /\b(recipe|cooking|restaurant review|horoscope)\b/i,
  /\b(stock market tip|crypto pump|nft)\b/i,
  /\b(transfer window|premier league|champions league)\b/i,
];

export function relevanceScore(title: string, body: string | null): number {
  const text = `${title}\n${body ?? ""}`;
  let score = 0;
  for (const re of POSITIVE) {
    if (re.test(text)) score += 1;
  }
  for (const re of NEGATIVE) {
    if (re.test(text)) score -= 2;
  }
  return score;
}

/** True if item is worth spending an extract call on. */
export function isLikelyIncident(title: string, body: string | null): boolean {
  return relevanceScore(title, body) >= 1;
}
