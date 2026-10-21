---
name: strifemap-ui
description: >-
  Use when changing Strife Map UI — map, pins, cluster popup, incident accordion,
  news wall, article view, light/dark, Polish/English, desktop or mobile. A short
  visual checklist. Not a new identity and not a product-rules file.
---

# Strife Map UI checklist

Product rules live in **repo-root `AGENTS.md`** (from this file: `../../../AGENTS.md`). This skill is only how to check a UI change before calling it done. Product name is Strife Map; skill path stays `strifemap-ui`.

## Before done

- Polish is the default. English exists. In the PL UI, do not show a raw English RSS title as the headline or body. The source is a separate link.
- Day stepper is the only time control.
- No country polygons, chips, country card, or country click.
- Expanded incident matches the news article: real photo when one exists, stored article summary, separate source link. No empty image placeholder. If there is no image, keep the text.
- News cards need a real image. Incidents with a photo also appear in News. The incident list stays an accordion, not a side panel.
- Cluster popup closes when the pointer leaves it. Keep only a short grace to move from the pin onto the list. On touch, a tap outside closes it.
- Light theme uses a light map. Dark theme uses a dark map. Check both if the change touches color or the map.
- On a phone (~390px), the header and controls must not cover the map so a tap still hits the map.
- Motion stays short and respects prefers-reduced-motion.
- Before done: click through the changed flow on desktop and at 390px. A single screenshot is not enough.
