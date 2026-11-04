import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import {
  createUrlWithParams,
  readCompareParam,
  readCountryParam,
  writeCompareParam,
  writeCountryParam,
} from "../src/utils/urlState.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installWindow(href) {
  const state = { url: new URL(href) };
  vi.stubGlobal("window", {
    location: {
      get href() { return state.url.href; },
      get search() { return state.url.search; },
    },
    history: {
      pushState(_data, _title, url) { state.url = new URL(url); },
      replaceState(_data, _title, url) { state.url = new URL(url); },
    },
  });
  return state;
}

test("share URLs keep unrelated state while replacing quiz, path, and layer parameters", () => {
  const shared = createUrlWithParams(
    "https://example.test/GlobeVision/?country=VN&compare=VN,JP&old=1",
    { old: null, quiz: "ASEAN", difficulty: "medium", quizType: "flag" }
  );
  const quizUrl = new URL(shared);
  assert.equal(quizUrl.searchParams.get("country"), "VN");
  assert.deepEqual(quizUrl.searchParams.get("compare").split(","), ["VN", "JP"]);
  assert.equal(quizUrl.searchParams.get("quiz"), "ASEAN");
  assert.equal(quizUrl.searchParams.get("difficulty"), "medium");

  const pathUrl = new URL(createUrlWithParams(shared, {
    quiz: null,
    difficulty: null,
    quizType: null,
    path: "mekong",
    layer: "rivers",
  }));
  assert.equal(pathUrl.searchParams.get("path"), "mekong");
  assert.equal(pathUrl.searchParams.get("layer"), "rivers");
  assert.equal(pathUrl.searchParams.has("quiz"), false);
  assert.equal(pathUrl.searchParams.get("country"), "VN");
});

test("country and comparison URL helpers normalize codes and preserve other state", () => {
  const state = installWindow("https://example.test/?quiz=ASEAN&layers=rivers");

  writeCountryParam("vn");
  assert.equal(readCountryParam(), "VN");
  writeCompareParam(["VN", "JP"]);
  assert.deepEqual(readCompareParam(), ["VN", "JP"]);
  assert.equal(state.url.searchParams.get("quiz"), "ASEAN");
  assert.equal(state.url.searchParams.get("layers"), "rivers");
  writeCountryParam(null);
  assert.equal(readCountryParam(), null);
});
