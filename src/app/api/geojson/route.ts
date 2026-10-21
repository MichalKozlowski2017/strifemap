import { NextRequest, NextResponse } from "next/server";
import { parseDateISO, todayISO } from "@/lib/dates";
import { getMapGeoJSON } from "@/lib/geo/incidents";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const dateParam = sp.get("date");
  const theater = sp.get("theater") ?? undefined;
  const date =
    dateParam && parseDateISO(dateParam) ? dateParam : todayISO();

  const geojson = await getMapGeoJSON({
    date,
    theaterSlug: theater || undefined,
  });

  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
