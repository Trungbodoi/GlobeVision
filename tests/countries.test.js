import { test } from "vitest";
import assert from "node:assert/strict";
import { searchCountries } from "../src/data/countries.js";

const countries = [
  {
    id: "US",
    iso2: "US",
    iso3: "USA",
    nameVi: "Hoa Kỳ",
    nameEn: "United States",
    nameLong: "United States of America",
    feature: { properties: { id: "US" } },
  },
  {
    id: "GB",
    iso2: "GB",
    iso3: "GBR",
    nameVi: "Vương quốc Anh",
    nameEn: "United Kingdom",
    feature: { properties: { id: "GB" } },
  },
  {
    id: "VN",
    iso2: "VN",
    iso3: "VNM",
    nameVi: "Việt Nam",
    nameEn: "Vietnam",
    feature: { properties: { id: "VN" } },
  },
  {
    id: "MY",
    iso2: "MY",
    iso3: "MYS",
    nameVi: "Malaysia",
    nameEn: "Malaysia",
    feature: { properties: { id: "MY" } },
  },
].map((properties) => ({
  ...properties,
  searchNames: [properties.nameVi, properties.nameEn, properties.nameLong, ...(properties.id === "US" ? ["Mỹ"] : [])]
    .filter(Boolean)
    .map((name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()),
  searchCodes: [properties.id, properties.iso2, properties.iso3]
    .filter(Boolean)
    .map((code) => code.toLowerCase()),
}));

test("country search normalizes accents and matches common aliases and ISO codes", () => {
  assert.equal(searchCountries(countries, "viet nam", "en")[0].id, "VN");
  assert.equal(searchCountries(countries, "USA", "en")[0].id, "US");
  assert.equal(searchCountries(countries, "united", "en")[0].id, "GB");
});

test("ISO codes match the typed text, so an accented name is not mistaken for a code", () => {
  assert.equal(searchCountries(countries, "Mỹ", "vi")[0].id, "US");
  assert.equal(searchCountries(countries, "MY", "vi")[0].id, "MY");
});

test("country search ranks exact codes and names first and respects the result limit", () => {
  const results = searchCountries(countries, "US", "en", 2);
  assert.equal(results[0].id, "US");
  const allMatches = searchCountries(countries, "united", "en", 8);
  assert.ok(allMatches.length > 1);
  assert.equal(searchCountries(countries, "united", "en", 1).length, 1);
  assert.deepEqual(searchCountries(countries, "", "en"), []);
});
