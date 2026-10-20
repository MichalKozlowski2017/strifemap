import { z } from "zod";

export const incidentExtractSchema = z.object({
  is_incident: z.boolean(),
  theater_slug: z
    .enum([
      "ukraine-russia",
      "middle-east",
      "africa",
      "indo-pacific",
      "europe-hybrid",
      "americas",
    ])
    .nullable(),
  type: z.enum([
    "kinetic",
    "sabotage",
    "cyber",
    "air",
    "naval",
    "diplomatic",
    "other",
  ]),
  title_pl: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200),
  summary_pl: z.string().min(1).max(800),
  summary_en: z.string().min(1).max(800),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  occurred_at: z.string().nullable(),
  confidence: z.enum(["confirmed", "reported", "unverified"]),
  merge_hint: z.string().nullable().optional(),
});

export type IncidentExtract = z.infer<typeof incidentExtractSchema>;

export const sitrepSchema = z.object({
  headline_pl: z.string(),
  headline_en: z.string(),
  body_pl: z.string(),
  body_en: z.string(),
  key_points_pl: z.array(z.string()).max(8),
  key_points_en: z.array(z.string()).max(8),
});

export type SitrepContent = z.infer<typeof sitrepSchema>;
