import { test } from "vitest";
import assert from "node:assert/strict";
import {
  buildAnswerOptions,
  buildRegionAnswerOptions,
  generateQuizQuestions,
  getDailySeed,
  getRegionOptions,
} from "../src/education/quizEngine.js";
import { reviewCard, selectDueCards } from "../src/education/srs.js";
import {
  createEmptyProgress,
  exportProgress,
  importProgress,
  recordAnswer,
} from "../src/education/progressStore.js";

const countries = [
  { id: "VN", apiCode: "VN", iso2: "VN", nameEn: "Vietnam", continent: "Asia", subregion: "South-Eastern Asia" },
  { id: "TH", apiCode: "TH", iso2: "TH", nameEn: "Thailand", continent: "Asia", subregion: "South-Eastern Asia" },
  { id: "JP", apiCode: "JP", iso2: "JP", nameEn: "Japan", continent: "Asia", subregion: "Eastern Asia" },
  { id: "FR", apiCode: "FR", iso2: "FR", nameEn: "France", continent: "Europe", subregion: "Western Europe" },
  { id: "DE", apiCode: "DE", iso2: "DE", nameEn: "Germany", continent: "Europe", subregion: "Western Europe" },
  { id: "US", apiCode: "US", iso2: "US", nameEn: "United States", continent: "North America", subregion: "Northern America" },
];

test("daily quizzes are reproducible and contain five questions", () => {
  const seed = `${getDailySeed("2026-11-02")}-Asia`;
  const options = { countries, region: "Asia", difficulty: "medium", seed, count: 5 };
  assert.deepEqual(generateQuizQuestions(options), generateQuizQuestions(options));
  assert.equal(generateQuizQuestions(options).length, 5);
  assert.ok(generateQuizQuestions(options).every((question) => question.promptCountry.continent === "Asia"));
  assert.equal(new Set(generateQuizQuestions(options).map((question) => question.type)).size, 4);
});

test("answer options include the correct answer and the requested choice count", () => {
  const options = buildAnswerOptions(countries, ["VN"], 4, "test-seed");
  assert.equal(options.length, 4);
  assert.ok(options.some((country) => country.id === "VN"));
  assert.equal(new Set(options.map((country) => country.id)).size, options.length);
});

test("region filters expose usable continent and subregion values", () => {
  const options = getRegionOptions(countries);
  assert.ok(options.some((option) => option.value === "Asia" && option.label === "Asia"));
  assert.ok(options.some((option) => option.value === "South-Eastern Asia"));
  assert.ok(generateQuizQuestions({
    countries,
    region: "South-Eastern Asia",
    difficulty: "easy",
    seed: "region-test",
    count: 2,
  }).every((question) => question.promptCountry.subregion === "South-Eastern Asia"));
});

test("small regions keep the requested number of choices without losing the right answer", () => {
  const options = buildRegionAnswerOptions(countries, "Eastern Asia", ["JP"], 6, "small-region");
  assert.equal(options.length, 6);
  assert.ok(options.some((country) => country.id === "JP"));
  const questions = generateQuizQuestions({
    countries,
    region: "Eastern Asia",
    difficulty: "easy",
    seed: "single-region",
    count: 5,
  });
  assert.equal(questions.length, 5);
  assert.ok(questions.every((question) => question.promptCountry.id === "JP"));
});

test("Leitner reviews reset incorrect cards and schedule correct cards", () => {
  const now = Date.UTC(2026, 0, 1);
  const firstReview = reviewCard(undefined, true, now);
  assert.equal(firstReview.box, 1);
  assert.equal(firstReview.dueAt, now + 24 * 60 * 60 * 1000);
  assert.equal(reviewCard(firstReview, false, now).box, 1);
  assert.deepEqual(selectDueCards({ VN: firstReview }, now), []);
  assert.deepEqual(selectDueCards({ VN: firstReview }, firstReview.dueAt), ["VN"]);
});

test("progress records accuracy, daily streaks, learned countries, and portable backups", () => {
  const dayOne = Date.UTC(2026, 0, 1, 12);
  let progress = createEmptyProgress();
  progress = recordAnswer(progress, "VN", true, dayOne);
  progress = recordAnswer(progress, "VN", true, dayOne);
  progress = recordAnswer(progress, "VN", true, dayOne);
  assert.deepEqual(progress.stats.learnedCountryIds, ["VN"]);
  progress = recordAnswer(progress, "TH", false, dayOne + 24 * 60 * 60 * 1000);
  assert.equal(progress.stats.streak, 2);
  assert.equal(progress.stats.totalAnswered, 4);
  assert.equal(progress.stats.totalCorrect, 3);

  const restored = importProgress(exportProgress(progress));
  assert.deepEqual(restored, progress);
  assert.throws(() => importProgress(JSON.stringify({ version: 99 })));
});
