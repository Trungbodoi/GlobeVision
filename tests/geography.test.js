import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGroupCountryIds, GROUP_OPTIONS } from "../src/data/organizations.js";
import { getWorldBankIndicatorWorld } from "../src/services/geographyApi.js";
import { INDICATORS } from "../src/services/worldBankApi.js";
import {
  createDidYouKnowFacts,
  getExplorerCountryColor,
  getGreatCircleDistanceKm,
  getMetricColor,
  getSolarCoordinates,
  GROUP_MEMBER_COLOR,
  GROUP_OUTSIDE_COLOR,
} from "../src/utils/geography.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("generated Natural Earth layers cover every requested spatial layer", () => {
  const geojson = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public", "data", "geography.geojson"), "utf8")
  );
  const counts = new Map();
  for (const feature of geojson.features) {
    counts.set(feature.properties.layer, (counts.get(feature.properties.layer) || 0) + 1);
  }

  for (const layer of ["river", "lake", "mountainRange", "mountainPeak", "capital", "dateLine"]) {
    assert.ok(counts.get(layer) > 0, `Expected Natural Earth data for ${layer}`);
  }
  assert.ok(counts.get("capital") > 150);
});

test("country group memberships use valid country IDs and expected membership counts", () => {
  const countries = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public", "data", "countries.geojson"), "utf8")
  ).features;
  const countryIds = new Set(countries.map((feature) => feature.properties.id));
  const expectedCounts = {
    asean: 10,
    eu: 27,
    g20: 19,
    un: 193,
    africanUnion: 55,
    landlocked: 44,
    island: 44,
  };

  for (const [group, count] of Object.entries(expectedCounts)) {
    const members = getGroupCountryIds(group);
    assert.equal(members.size, count, `${group} membership count`);
    assert.ok([...members].every((id) => countryIds.has(id)), `${group} has an unknown country ID`);
  }
  assert.equal(GROUP_OPTIONS.length, 8);
});

test("per-capita CO2 data uses the current World Bank indicator", () => {
  assert.equal(INDICATORS.co2PerCapita.id, "EN.GHG.CO2.PC.CE.AR5");
});

test("World Bank choropleths query only supported map countries", async () => {
  const requests = [];
  const responses = [
    [
      { page: 1, pages: 1, total: 3 },
      [
        { id: "USA", region: { id: "NAC" } },
        { id: "VNM", region: { id: "EAS" } },
        { id: "AFE", region: { id: "NA" } },
      ],
    ],
    [
      { page: 1, pages: 1, total: 2 },
      [
        { countryiso3code: "USA", date: "2024", value: 78.9 },
        { countryiso3code: "VNM", date: "2024", value: 74.7 },
      ],
    ],
  ];
  vi.stubGlobal("fetch", async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => responses.shift(),
    };
  });

  const result = await getWorldBankIndicatorWorld(
    INDICATORS.lifeExpectancy.id,
    ["VNM", "USA", "AFE"]
  );

  assert.equal(requests.length, 2);
  assert.match(requests[1], /\/country\/USA;VNM\/indicator\/SP\.DYN\.LE00\.IN/);
  assert.equal(result.values.get("VNM").value, 74.7);
  assert.equal(result.values.get("USA").year, 2024);
});

test("great-circle distance handles coincident, short, and antipodal points", () => {
  const origin = { lat: 0, lng: 0 };
  assert.equal(getGreatCircleDistanceKm(origin, origin), 0);
  assert.ok(Math.abs(getGreatCircleDistanceKm(origin, { lat: 0, lng: 1 }) - 111.195) < 0.1);
  assert.ok(Math.abs(getGreatCircleDistanceKm(origin, { lat: 0, lng: 180 }) - 20015.1) < 0.1);
});

test("solar coordinates follow equinoxes and solstices", () => {
  const equinox = getSolarCoordinates(new Date("2026-03-20T14:46:00Z"));
  const solstice = getSolarCoordinates(new Date("2026-06-21T08:25:00Z"));
  assert.ok(Math.abs(equinox.lat) < 0.1);
  assert.ok(Math.abs(solstice.lat - 23.44) < 0.2);
  assert.ok(equinox.lng >= -180 && equinox.lng <= 180);
});

test("choropleth uses valid Viridis colors and ignores missing or non-positive values", () => {
  const colors = [1, 10, 100].map((value) => getMetricColor(value, [1, 10, 100], true));
  assert.equal(colors[0], "#440154");
  assert.equal(colors[2], "#fde725");
  assert.equal(getMetricColor(0, [0, 0], true), null);
});

test("group filter dims outsiders while members keep their metric color", () => {
  const vn = { id: "VN", iso3: "VNM" };
  const fr = { id: "FR", iso3: "FRA" };
  const la = { id: "LA", iso3: "LAO" };
  const metricColors = new Map([["VNM", "#21918c"], ["FRA", "#fde725"]]);
  const groupCountryIds = new Set(["VN", "LA"]);

  const both = { group: "asean", groupCountryIds, metric: "density", metricColors };
  assert.equal(getExplorerCountryColor(vn, both), "#21918c");
  assert.equal(getExplorerCountryColor(fr, both), GROUP_OUTSIDE_COLOR);
  assert.equal(getExplorerCountryColor(la, both), null, "a member with no data is not shown as a value");

  const groupOnly = { group: "asean", groupCountryIds, metric: "none", metricColors: new Map() };
  assert.equal(getExplorerCountryColor(vn, groupOnly), GROUP_MEMBER_COLOR);
  assert.equal(getExplorerCountryColor(fr, groupOnly), GROUP_OUTSIDE_COLOR);

  const metricOnly = { group: "none", groupCountryIds: new Set(), metric: "density", metricColors };
  assert.equal(getExplorerCountryColor(fr, metricOnly), "#fde725");

  assert.equal(getExplorerCountryColor(vn, undefined), null, "nothing is dimmed before the explorer loads");
});

test("did-you-know facts are derived from country population records", () => {
  const countries = [
    { nameVi: "Nước A", nameEn: "Country A", popEst: 100, popYear: 2020, continent: "Asia" },
    { nameVi: "Nước B", nameEn: "Country B", popEst: 500, popYear: 2019, continent: "Asia" },
    { nameVi: "Nước C", nameEn: "Country C", popEst: 50, popYear: 2018, continent: "Europe" },
  ];
  const facts = createDidYouKnowFacts(countries, "en");
  assert.equal(facts.length, 3);
  assert.equal(facts[0].type, "largestPopulation");
  assert.equal(facts[0].country, "Country B");
  assert.equal(facts[1].country, "Country C");
  assert.equal(facts[2].continent, "Asia");
});
