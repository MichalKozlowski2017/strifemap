export type Locale = "pl" | "en";

export const LOCALE_COOKIE = "wn_lang";

export const dict = {
  pl: {
    tagline: "Wywiad konfliktowy",
    panel: "Panel",
    today: "Dziś",
    prevDay: "Poprzedni dzień",
    nextDay: "Następny dzień",
    dayBrief: "Dzień w skrócie",
    emptyDay: "Brak mapowanych incydentów tego dnia.",
    emptyDayHint: "Wybierz inny dzień strzałkami lub wróć do dziś.",
    loadingMap: "Ładowanie mapy…",
    mapError: "Błąd danych mapy",
    sources: "Źródła",
    theater: "Teatr",
    incidents: "Incydenty",
    sitrep: "Sitrep",
    noSitrep: "Brak briefingu na ten dzień.",
    noSitrepNoIncidents: "Brak mapowanych incydentów — nie ma z czego zbudować sitrep.",
    backToMap: "← Mapa",
    legend: "Legenda",
    close: "Zamknij",
    details: "Szczegóły",
    clusterIncidents: "Incydenty w klastrze",
    noSources: "Brak źródeł",
    type: {
      kinetic: "atak",
      sabotage: "sabotaż",
      cyber: "cyber",
      air: "powietrze",
      naval: "morski",
      diplomatic: "dyplomacja",
      other: "inne",
    },
    confidence: {
      confirmed: "potwierdzone",
      reported: "doniesienie",
      unverified: "niepotwierdzone",
    },
  },
  en: {
    tagline: "Conflict intelligence",
    panel: "Panel",
    today: "Today",
    prevDay: "Previous day",
    nextDay: "Next day",
    dayBrief: "Day in brief",
    emptyDay: "No mapped incidents for this day.",
    emptyDayHint: "Pick another day with the arrows, or jump to today.",
    loadingMap: "Loading map…",
    mapError: "Map data error",
    sources: "Sources",
    theater: "Theater",
    incidents: "Incidents",
    sitrep: "Sitrep",
    noSitrep: "No briefing for this day.",
    noSitrepNoIncidents:
      "No mapped incidents — nothing to build a sitrep from.",
    backToMap: "← Map",
    legend: "Legend",
    close: "Close",
    details: "Details",
    clusterIncidents: "Incidents in cluster",
    noSources: "No sources",
    type: {
      kinetic: "attack",
      sabotage: "sabotage",
      cyber: "cyber",
      air: "air",
      naval: "naval",
      diplomatic: "diplomatic",
      other: "other",
    },
    confidence: {
      confirmed: "confirmed",
      reported: "reported",
      unverified: "unverified",
    },
  },
} as const;

export type Dictionary = (typeof dict)[Locale];

export function t(locale: Locale): Dictionary {
  return dict[locale] ?? dict.pl;
}
