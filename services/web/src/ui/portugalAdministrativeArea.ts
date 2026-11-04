import administrativeAreasUrl from "../data/portugalAdministrativeAreas.json?url";

type Position = readonly [number, number];
type LinearRing = readonly Position[];
type PolygonCoordinates = readonly LinearRing[];
type MultiPolygonCoordinates = readonly PolygonCoordinates[];

export type AdministrativeArea = {
  properties: { label: string };
  geometry:
    | { type: "Polygon"; coordinates: PolygonCoordinates }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates };
};

let administrativeAreasPromise: Promise<readonly AdministrativeArea[]> | undefined;

function isPosition(value: unknown): value is Position {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === "number"
    && Number.isFinite(value[0])
    && typeof value[1] === "number"
    && Number.isFinite(value[1]);
}

function isLinearRing(value: unknown): value is LinearRing {
  return Array.isArray(value) && value.length >= 4 && value.every(isPosition);
}

function isPolygonCoordinates(value: unknown): value is PolygonCoordinates {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing);
}

function isMultiPolygonCoordinates(value: unknown): value is MultiPolygonCoordinates {
  return Array.isArray(value) && value.length > 0 && value.every(isPolygonCoordinates);
}

function isAdministrativeArea(value: unknown): value is AdministrativeArea {
  if (typeof value !== "object" || value === null) return false;
  const feature = value as Record<string, unknown>;
  if (typeof feature.properties !== "object" || feature.properties === null
    || typeof feature.geometry !== "object" || feature.geometry === null) return false;

  const properties = feature.properties as Record<string, unknown>;
  const geometry = feature.geometry as Record<string, unknown>;
  if (typeof properties.label !== "string" || properties.label.trim() === "") return false;

  return (geometry.type === "Polygon" && isPolygonCoordinates(geometry.coordinates))
    || (geometry.type === "MultiPolygon" && isMultiPolygonCoordinates(geometry.coordinates));
}

function isAdministrativeAreasCollection(value: unknown): value is { features: AdministrativeArea[] } {
  if (typeof value !== "object" || value === null) return false;
  const collection = value as Record<string, unknown>;
  const features = collection.features;
  return collection.type === "FeatureCollection"
    && Array.isArray(features)
    && features.length > 0
    && features.every(isAdministrativeArea);
}

export function parseAdministrativeAreas(data: unknown): readonly AdministrativeArea[] {
  if (!isAdministrativeAreasCollection(data)) {
    throw new Error("O ficheiro de limites administrativos tem um formato inválido.");
  }
  return data.features;
}

async function loadAdministrativeAreas(): Promise<readonly AdministrativeArea[]> {
  if (!administrativeAreasPromise) {
    administrativeAreasPromise = fetch(administrativeAreasUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`O ficheiro de limites respondeu com o estado ${response.status}.`);
        }

        const data: unknown = await response.json();
        return parseAdministrativeAreas(data);
      })
      .catch((error: unknown) => {
        administrativeAreasPromise = undefined;
        throw error;
      });
  }

  return administrativeAreasPromise;
}

function isPointOnSegment(
  longitude: number,
  latitude: number,
  start: Position,
  end: Position,
): boolean {
  const epsilon = 1e-10;
  const crossProduct = (longitude - start[0]) * (end[1] - start[1])
    - (latitude - start[1]) * (end[0] - start[0]);
  if (Math.abs(crossProduct) > epsilon) return false;

  return longitude >= Math.min(start[0], end[0]) - epsilon
    && longitude <= Math.max(start[0], end[0]) + epsilon
    && latitude >= Math.min(start[1], end[1]) - epsilon
    && latitude <= Math.max(start[1], end[1]) + epsilon;
}

function ringContainsPoint(ring: LinearRing, longitude: number, latitude: number): boolean {
  let containsPoint = false;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const start = ring[previousIndex];
    const end = ring[index];

    if (isPointOnSegment(longitude, latitude, start, end)) return true;

    const crossesLatitude = (start[1] > latitude) !== (end[1] > latitude);
    if (crossesLatitude
      && longitude < ((end[0] - start[0]) * (latitude - start[1])) / (end[1] - start[1]) + start[0]) {
      containsPoint = !containsPoint;
    }
  }

  return containsPoint;
}

function polygonContainsPoint(
  polygon: PolygonCoordinates,
  longitude: number,
  latitude: number,
): boolean {
  const [outerRing, ...holes] = polygon;
  return ringContainsPoint(outerRing, longitude, latitude)
    && !holes.some((hole) => ringContainsPoint(hole, longitude, latitude));
}

function areaContainsPoint(
  area: AdministrativeArea,
  longitude: number,
  latitude: number,
): boolean {
  const polygons = area.geometry.type === "Polygon"
    ? [area.geometry.coordinates]
    : area.geometry.coordinates;

  return polygons.some((polygon) => polygonContainsPoint(polygon, longitude, latitude));
}

export function findAdministrativeAreaLabel(
  latitude: number,
  longitude: number,
  administrativeAreas: readonly AdministrativeArea[],
): string | null {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  return administrativeAreas.find((area) => areaContainsPoint(area, longitude, latitude))
    ?.properties.label ?? null;
}

export async function getAdministrativeAreaLabel(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  const administrativeAreas = await loadAdministrativeAreas();
  return findAdministrativeAreaLabel(latitude, longitude, administrativeAreas);
}
