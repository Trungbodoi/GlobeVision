import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const OUTPUT = path.join(ROOT, "public", "data", "geography.geojson");

async function readLayer(filename) {
  const response = await fetch(`${SOURCE_URL}/${filename}`);
  if (!response.ok) {
    throw new Error(`Could not download Natural Earth ${filename}: HTTP ${response.status}`);
  }
  return response.json();
}

function feature(layer, name, geometry, properties = {}) {
  return {
    type: "Feature",
    properties: { layer, name, ...properties },
    geometry,
  };
}

const [rivers, lakes, ranges, peaks, geographicLines, populatedPlaces] = await Promise.all([
  readLayer("ne_110m_rivers_lake_centerlines.geojson"),
  readLayer("ne_110m_lakes.geojson"),
  readLayer("ne_110m_geography_regions_polys.geojson"),
  readLayer("ne_110m_geography_regions_elevation_points.geojson"),
  readLayer("ne_110m_geographic_lines.geojson"),
  readLayer("ne_110m_populated_places.geojson"),
]);

const features = [
  ...rivers.features.map((item) =>
    feature("river", item.properties.name_en || item.properties.name, item.geometry)
  ),
  ...lakes.features.map((item) =>
    feature("lake", item.properties.name_en || item.properties.name, item.geometry)
  ),
  ...ranges.features
    .filter((item) => item.properties.FEATURECLA === "Range/mtn")
    .map((item) => feature("mountainRange", item.properties.NAME_EN || item.properties.NAME, item.geometry)),
  ...peaks.features
    .filter((item) => item.properties.featurecla === "mountain" && item.properties.name)
    .map((item) =>
      feature("mountainPeak", item.properties.name, item.geometry, {
        elevation: item.properties.elevation,
      })
    ),
  ...geographicLines.features
    .filter((item) => item.properties.featurecla === "Date line")
    .map((item) =>
      feature("dateLine", item.properties.name_en || item.properties.name, item.geometry)
    ),
  ...populatedPlaces.features
    .filter(
      (item) =>
        item.properties.FEATURECLA === "Admin-0 capital" &&
        Number(item.properties.ADM0CAP) === 1 &&
        item.geometry?.type === "Point"
    )
    .map((item) => {
      const properties = item.properties;
      return feature("capital", properties.NAME_EN || properties.NAME, item.geometry, {
        iso2: properties.ISO_A2_EH || properties.ISO_A2 || null,
        iso3: properties.ADM0_A3 || null,
        timezone: properties.TIMEZONE || null,
        population: Number(properties.POP_MAX) || null,
      });
    }),
];

const result = { type: "FeatureCollection", features };
fs.writeFileSync(OUTPUT, JSON.stringify(result));
console.log(
  `Wrote ${features.length} Natural Earth features to public/data/geography.geojson ` +
    `(${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB).`
);
