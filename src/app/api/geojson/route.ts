import { NextRequest, NextResponse } from "next/server";
import { getMapGeoJSON } from "@/lib/geo/incidents";


export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const hours = Number(request.nextUrl.searchParams.get("hours") ?? 72);
  const theater = request.nextUrl.searchParams.get("theater") ?? undefined;

  const geojson = await getMapGeoJSON({
    hours: Number.isFinite(hours) ? hours : 72,
    theaterSlug: theater || undefined,
  });

  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
