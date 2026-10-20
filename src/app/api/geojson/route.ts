import { NextRequest, NextResponse } from "next/server";
import { parseDateISO } from "@/lib/dates";
import { getMapGeoJSON } from "@/lib/geo/incidents";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const date =
    dateParam && parseDateISO(dateParam) ? dateParam : undefined;
  const hours = Number(request.nextUrl.searchParams.get("hours") ?? 72);
  const theater = request.nextUrl.searchParams.get("theater") ?? undefined;

  const geojson = await getMapGeoJSON({
    date,
    hours: date ? undefined : Number.isFinite(hours) ? hours : 72,
    theaterSlug: theater || undefined,
  });

  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
