import fs from "node:fs";
import path from "node:path";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { countryDisplayName } from "@/lib/geo/country-names";
import type { Locale } from "@/lib/i18n/dictionary";

export type CountryProps = {
  iso: string;
  name_en: string;
  name_pl?: string | null;
};

type CountryFeature = Feature<Polygon | MultiPolygon, CountryProps>;

let cached: FeatureCollection<Polygon | MultiPolygon, CountryProps> | null =
  null;

function countriesPath(): string {
  return path.join(process.cwd(), "public", "geo", "countries-110m.geojson");
}

export function loadCountries(): FeatureCollection<
  Polygon | MultiPolygon,
  CountryProps
> {
  if (cached) return cached;
  const raw = fs.readFileSync(countriesPath(), "utf8");
  cached = JSON.parse(raw) as FeatureCollection<
    Polygon | MultiPolygon,
    CountryProps
  >;
  return cached;
}

function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  // Ray casting
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(
  lng: number,
  lat: number,
  geometry: Polygon | MultiPolygon,
): boolean {
  const polys =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const poly of polys) {
    if (!poly.length) continue;
    if (!pointInRing(lng, lat, poly[0])) continue;
    // holes
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(lng, lat, poly[h])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function isoFromLatLng(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const countries = loadCountries();
  for (const f of countries.features) {
    if (!f.geometry) continue;
    if (pointInPolygon(lng, lat, f.geometry)) {
      return f.properties.iso?.toUpperCase() || null;
    }
  }
  return null;
}

export function getCountryFeature(iso: string): CountryFeature | null {
  const code = iso.toUpperCase();
  const countries = loadCountries();
  return (
    (countries.features.find(
      (f) => f.properties.iso?.toUpperCase() === code,
    ) as CountryFeature | undefined) ?? null
  );
}

export function getCountryBbox(
  iso: string,
): [west: number, south: number, east: number, north: number] | null {
  const f = getCountryFeature(iso);
  if (!f?.geometry) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (coords: Position[][][] | Position[][]) => {
    for (const part of coords) {
      if (typeof part[0]?.[0] === "number") {
        for (const p of part as Position[]) {
          minX = Math.min(minX, p[0]);
          maxX = Math.max(maxX, p[0]);
          minY = Math.min(minY, p[1]);
          maxY = Math.max(maxY, p[1]);
        }
      } else {
        walk(part as Position[][]);
      }
    }
  };
  if (f.geometry.type === "Polygon") walk(f.geometry.coordinates);
  else walk(f.geometry.coordinates);
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

export function countryName(iso: string, locale: Locale): string {
  const f = getCountryFeature(iso);
  return countryDisplayName(iso, locale, f?.properties.name_en);
}

export function listCountryIsos(): string[] {
  return loadCountries().features.map((f) => f.properties.iso.toUpperCase());
}
