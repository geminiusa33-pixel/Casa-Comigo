import { describe, expect, it } from "vitest";
import administrativeAreasJson from "../data/portugalAdministrativeAreas.json?raw";
import {
  findAdministrativeAreaLabel,
  parseAdministrativeAreas,
  type AdministrativeArea,
} from "./portugalAdministrativeArea";

const areas: readonly AdministrativeArea[] = [
  {
    properties: { label: "Distrito de Lisboa" },
    geometry: {
      type: "Polygon",
      coordinates: [[[-10, 30], [0, 30], [0, 40], [-10, 40], [-10, 30]]],
    },
  },
  {
    properties: { label: "Distrito de Porto" },
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 30], [10, 30], [10, 40], [0, 40], [0, 30]]],
        [[[20, 30], [30, 30], [30, 40], [20, 40], [20, 30]]],
      ],
    },
  },
];

describe("findAdministrativeAreaLabel", () => {
  it("finds the administrative area containing the GPS point", () => {
    expect(findAdministrativeAreaLabel(35, -5, areas)).toBe("Distrito de Lisboa");
    expect(findAdministrativeAreaLabel(35, 5, areas)).toBe("Distrito de Porto");
    expect(findAdministrativeAreaLabel(35, 25, areas)).toBe("Distrito de Porto");
  });

  it("returns null for points outside Portugal or invalid coordinates", () => {
    expect(findAdministrativeAreaLabel(50, 15, areas)).toBeNull();
    expect(findAdministrativeAreaLabel(Number.NaN, 0, areas)).toBeNull();
    expect(findAdministrativeAreaLabel(0, 181, areas)).toBeNull();
  });

  it("does not classify a point inside a polygon hole", () => {
    const areaWithHole: AdministrativeArea = {
      properties: { label: "Distrito de Lisboa" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [[-10, 30], [10, 30], [10, 50], [-10, 50], [-10, 30]],
          [[-5, 35], [5, 35], [5, 45], [-5, 45], [-5, 35]],
        ],
      },
    };

    expect(findAdministrativeAreaLabel(32, 0, [areaWithHole])).toBe("Distrito de Lisboa");
    expect(findAdministrativeAreaLabel(40, 0, [areaWithHole])).toBeNull();
  });
});

describe("CAOP2025 administrative area boundaries", () => {
  const actualAreas = parseAdministrativeAreas(JSON.parse(administrativeAreasJson));

  it.each([
    ["Lisboa", 38.7223, -9.1393, "Distrito de Lisboa"],
    ["Porto", 41.1579, -8.6291, "Distrito de Porto"],
    ["Coimbra", 40.2033, -8.4103, "Distrito de Coimbra"],
    ["Açores", 37.7412, -25.6756, "Ilha de São Miguel"],
    ["Madeira", 32.6669, -16.9241, "Ilha da Madeira"],
  ])("identifies %s from its coordinates", (_name, latitude, longitude, expectedLabel) => {
    expect(findAdministrativeAreaLabel(latitude, longitude, actualAreas)).toBe(expectedLabel);
  });

  it("does not label a point outside Portugal", () => {
    expect(findAdministrativeAreaLabel(40.7128, -74.006, actualAreas)).toBeNull();
  });
});
