import { test } from "vitest";
import assert from "node:assert/strict";
import {
  answersOnGlobe,
  buildAnswerOptions,
  buildQuestionOptions,
  buildRegionAnswerOptions,
  generateQuizQuestions,
  getAnswerFromCountryInfo,
  getDailySeed,
  getFlagUrl,
  getQuizCountries,
  getRegionOptions,
  getReplacementCountries,
} from "../src/education/quizEngine.js";
import { getLocalDateKey, getPreviousLocalDateKey } from "../src/education/dateKey.js";
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
  const asia = [
    ...countries,
    ...["LA", "KH"].map((id) => ({ id, apiCode: id, iso2: id, continent: "Asia", subregion: "South-Eastern Asia" })),
  ];
  const options = { countries: asia, region: "Asia", difficulty: "medium", seed, count: 5 };
  assert.deepEqual(generateQuizQuestions(options), generateQuizQuestions(options));
  assert.equal(generateQuizQuestions(options).length, 5);
  assert.ok(generateQuizQuestions(options).every((question) => question.promptCountry.continent === "Asia"));
  assert.equal(new Set(generateQuizQuestions(options).map((question) => question.type)).size, 4);
});

test("find questions and hard questions are answered on the globe at every difficulty", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    assert.equal(answersOnGlobe({ type: "find", difficulty }), true);
  }
  for (const type of ["flag", "capital", "neighbor"]) {
    assert.equal(answersOnGlobe({ type, difficulty: "easy" }), false);
    assert.equal(answersOnGlobe({ type, difficulty: "medium" }), false);
    assert.equal(answersOnGlobe({ type, difficulty: "hard" }), true);
  }
});

test("island countries cannot produce a neighbor question while bordered countries can", () => {
  const atlas = [
    { id: "VN", iso3: "VNM", apiCode: "VN" },
    { id: "LA", iso3: "LAO", apiCode: "LA" },
    { id: "VU", iso3: "VUT", apiCode: "VU" },
  ];
  const neighbor = { type: "neighbor", seed: "seed-1" };
  const capital = { type: "capital", seed: "seed-1" };

  assert.equal(getAnswerFromCountryInfo(neighbor, atlas[2], {}, atlas), null);
  assert.equal(getAnswerFromCountryInfo(neighbor, atlas[2], { borders: [] }, atlas), null);
  assert.equal(getAnswerFromCountryInfo(neighbor, atlas[0], { borders: ["XXX"] }, atlas), null);
  assert.deepEqual(
    getAnswerFromCountryInfo(neighbor, atlas[0], { borders: ["LAO"] }, atlas),
    { answerIds: ["LA"], shownAnswerId: "LA" }
  );

  assert.equal(getAnswerFromCountryInfo(capital, atlas[2], {}, atlas), null);
  assert.deepEqual(
    getAnswerFromCountryInfo(capital, atlas[2], { capital: "Port Vila" }, atlas),
    { answerIds: ["VU"], shownAnswerId: "VU", capital: "Port Vila" }
  );
});

test("replacement countries stay in the region, skip used countries and are reproducible", () => {
  const options = {
    countries,
    region: "Asia",
    questions: [{ promptCountry: { id: "VN" } }],
    seed: "2026-11-05",
  };
  const replacements = getReplacementCountries(options).map((country) => country.id);

  assert.deepEqual([...replacements].sort(), ["JP", "TH"]);
  assert.deepEqual(getReplacementCountries(options).map((country) => country.id), replacements);
  assert.equal(getReplacementCountries({ ...options, limit: 1 }).length, 1);
  assert.deepEqual(
    getReplacementCountries({
      ...options,
      questions: ["VN", "TH", "JP"].map((id) => ({ promptCountry: { id } })),
    }),
    [],
    "an exhausted region has no replacement, so the question falls back to a flag"
  );
});

test("flag images are built from a valid two-letter country code", () => {
  assert.equal(getFlagUrl("SG"), "https://flagcdn.com/sg.svg");
  assert.equal(getFlagUrl("CYN"), null);
  assert.equal(getFlagUrl(null), null);
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
  assert.equal(questions.length, 1, "a small region shortens the quiz instead of repeating a country");
  assert.equal(questions[0].promptCountry.id, "JP");
});

test("quiz countries are limited to UN members", () => {
  const pool = getQuizCountries([
    { id: "VN", apiCode: "VN" },
    { id: "AX", apiCode: "AX" },
    { id: "SOL", apiCode: null },
  ]);
  assert.deepEqual(pool.map((country) => country.id), ["VN"]);
});

test("every neighbor counts as correct and options never contain a second correct answer", () => {
  const atlas = [
    { id: "VN", iso3: "VNM", apiCode: "VN", continent: "Asia" },
    { id: "LA", iso3: "LAO", apiCode: "LA", continent: "Asia" },
    { id: "KH", iso3: "KHM", apiCode: "KH", continent: "Asia" },
    { id: "CN", iso3: "CHN", apiCode: "CN", continent: "Asia" },
    { id: "JP", iso3: "JPN", apiCode: "JP", continent: "Asia" },
    { id: "TH", iso3: "THA", apiCode: "TH", continent: "Asia" },
    { id: "FR", iso3: "FRA", apiCode: "FR", continent: "Europe" },
    { id: "DE", iso3: "DEU", apiCode: "DE", continent: "Europe" },
  ];
  const question = { type: "neighbor", seed: "neighbors" };
  const answer = getAnswerFromCountryInfo(question, atlas[0], { borders: ["LAO", "KHM", "CHN"] }, atlas);
  assert.deepEqual(answer.answerIds, ["LA", "KH", "CN"]);
  assert.ok(answer.answerIds.includes(answer.shownAnswerId));

  const options = buildQuestionOptions({
    countries: atlas,
    region: "Asia",
    promptId: "VN",
    ...answer,
    count: 4,
    seed: "neighbors",
  }).map((country) => country.id);
  assert.equal(options.length, 4);
  assert.equal(options.filter((id) => answer.answerIds.includes(id)).length, 1);
  assert.ok(options.includes(answer.shownAnswerId));
  assert.ok(!options.includes("VN"), "the country in the question is not offered as an answer");
});

test("daily seeds and study streaks follow the local calendar day", () => {
  const lateEvening = new Date(2026, 10, 5, 23, 30);
  const earlyMorning = new Date(2026, 10, 6, 0, 30);
  assert.equal(getLocalDateKey(lateEvening), "2026-11-05");
  assert.equal(getLocalDateKey(earlyMorning), "2026-11-06");
  assert.notEqual(getDailySeed(lateEvening), getDailySeed(earlyMorning));
  assert.equal(getPreviousLocalDateKey(new Date(2026, 2, 1, 12)), "2026-02-28");

  let progress = recordAnswer(createEmptyProgress(), "VN", true, lateEvening.getTime());
  progress = recordAnswer(progress, "VN", true, earlyMorning.getTime());
  assert.equal(progress.stats.streak, 2);
  assert.equal(progress.stats.lastStudyDate, "2026-11-06");
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
