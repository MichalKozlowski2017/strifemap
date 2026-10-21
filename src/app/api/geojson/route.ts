import { NextRequest, NextResponse } from "next/server";
import { parseDateISO } from "@/lib/dates";
import { getMapGeoJSON } from "@/lib/geo/incidents";
import {
  hoursForTimeRange,
  parseTimeRange,
} from "@/lib/map/params";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const timeRangeRaw = sp.get("timeRange");
  const dateParam = sp.get("date");
  const theater = sp.get("theater") ?? undefined;

  // Prefer shareable timeRange (map live window). Day `date` is for brief/news only.
  if (timeRangeRaw || sp.has("hours")) {
    const range = parseTimeRange(timeRangeRaw);
    const hoursParam = Number(sp.get("hours"));
    const hours = Number.isFinite(hoursParam) && hoursParam > 0
      ? hoursParam
      : hoursForTimeRange(range);
    const geojson = await getMapGeoJSON({
      hours,
      theaterSlug: theater || undefined,
    });
    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  }

  const date =
    dateParam && parseDateISO(dateParam) ? dateParam : undefined;
  const geojson = await getMapGeoJSON({
    date,
    hours: date ? undefined : 168,
    theaterSlug: theater || undefined,
  });

  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
