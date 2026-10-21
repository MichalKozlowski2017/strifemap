export type IncidentType =
  | "kinetic"
  | "sabotage"
  | "cyber"
  | "air"
  | "naval"
  | "diplomatic"
  | "other";

export type Confidence = "confirmed" | "reported" | "unverified";

export type IncidentStatus = "pending" | "approved" | "rejected" | "published";

export type BriefKind = "daily_sitrep" | "weekly";

export type RawEventStatus = "pending" | "processed" | "skipped" | "error";

export type Theater = {
  id: string;
  slug: string;
  name_pl: string;
  name_en: string;
  center_lat: number | null;
  center_lng: number | null;
  bbox_west: number | null;
  bbox_south: number | null;
  bbox_east: number | null;
  bbox_north: number | null;
  sort: number;
  description_pl: string | null;
  description_en: string | null;
};

export type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  theater_id: string | null;
  enabled: number;
  trust_weight: number;
};

export type RawEvent = {
  id: string;
  source_id: string;
  url: string;
  title: string;
  body: string | null;
  content_hash: string;
  fetched_at: string;
  processed_at: string | null;
  status: RawEventStatus;
};

export type Incident = {
  id: string;
  theater_id: string;
  type: IncidentType;
  title: string;
  summary: string;
  title_pl: string | null;
  title_en: string | null;
  summary_pl: string | null;
  summary_en: string | null;
  lat: number | null;
  lng: number | null;
  occurred_at: string;
  confidence: Confidence;
  status: IncidentStatus;
  map_eligible: number;
  created_at: string;
  updated_at: string;
};

export type Brief = {
  id: string;
  theater_id: string;
  kind: BriefKind;
  lang: string;
  content: string;
  created_at: string;
  for_date: string | null;
};

export type IncidentSourceLink = {
  incident_id: string;
  raw_event_id: string;
  url?: string;
  title?: string;
  source_name?: string;
};

export type MapIncidentFeatureProps = {
  id: string;
  title: string;
  summary: string;
  title_pl?: string | null;
  title_en?: string | null;
  summary_pl?: string | null;
  summary_en?: string | null;
  type: IncidentType;
  confidence: Confidence;
  theater_slug: string;
  theater_name_pl: string;
  theater_name_en?: string;
  occurred_at: string;
  /** 1 when occurred within the last few hours (pulse). */
  fresh?: 0 | 1;
};
