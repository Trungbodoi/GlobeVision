const ASEAN_IDS = new Set(["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "VN"]);

export const QUIZ_TYPES = ["find", "flag", "capital", "neighbor"];
export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"];

export function getDailySeed(date = new Date()) {
  const dateKey = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  return `globevision-daily-${dateKey}`;
}

export function createSeededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function getRegionOptions(countries) {
  return [
    { value: "all", label: "all" },
    { value: "ASEAN", label: "ASEAN" },
    ...[...new Set(countries.flatMap(({ continent, subregion }) => [continent, subregion]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name })),
  ];
}

export function filterCountries(countries, region = "all") {
  if (region === "all") return countries;
  if (region === "ASEAN") return countries.filter((country) => ASEAN_IDS.has(country.id));
  return countries.filter(
    (country) => country.continent === region || country.subregion === region
  );
}

export function generateQuizQuestions({
  countries,
  region = "all",
  type = "mixed",
  difficulty = "easy",
  seed = `${Date.now()}`,
  count = 10,
}) {
  const pool = filterCountries(countries, region).filter((country) => country.apiCode);
  if (pool.length < 1) throw new Error("No countries are available for this quiz region.");
  if (!QUIZ_DIFFICULTIES.includes(difficulty)) throw new Error("Unknown quiz difficulty.");
  if (type !== "mixed" && !QUIZ_TYPES.includes(type)) throw new Error("Unknown quiz type.");

  const random = createSeededRandom(seed);
  const shuffledPool = shuffle(pool, random);
  const mixedTypes = type === "mixed"
    ? shuffle(Array.from({ length: count }, (_, index) => QUIZ_TYPES[index % QUIZ_TYPES.length]), random)
    : null;

  return Array.from({ length: count }, (_, index) => {
    const questionType = mixedTypes ? mixedTypes[index] : type;
    return {
      id: `${seed}-${index}`,
      type: questionType,
      promptCountry: shuffledPool[index % shuffledPool.length],
      difficulty,
      seed: `${seed}-${index}`,
    };
  });
}

export function buildAnswerOptions(countries, correctIds, count, seed) {
  const correct = countries.filter((country) => correctIds.includes(country.id));
  if (correct.length === 0) throw new Error("No valid answer is available for this question.");

  const correctIdSet = new Set(correct.map((country) => country.id));
  const random = createSeededRandom(seed);
  const distractors = shuffle(
    countries.filter((country) => country.apiCode && !correctIdSet.has(country.id)),
    random
  ).slice(0, Math.max(0, count - correct.length));

  return shuffle([...correct, ...distractors], random);
}

export function buildRegionAnswerOptions(countries, region, correctIds, count, seed) {
  const correctIdsSet = new Set(correctIds);
  const preferred = filterCountries(countries, region);
  const preferredIds = new Set(preferred.map((country) => country.id));
  const correct = countries.filter((country) => correctIdsSet.has(country.id));
  const localPool = [...preferred, ...correct.filter((country) => !preferredIds.has(country.id))];
  const localOptions = buildAnswerOptions(localPool, correctIds, count, seed);
  if (localOptions.length >= count) return localOptions;

  const localIds = new Set(localPool.map((country) => country.id));
  return buildAnswerOptions(
    [...localPool, ...countries.filter((country) => !localIds.has(country.id))],
    correctIds,
    count,
    seed
  );
}

export function getFlagEmoji(iso2) {
  if (!/^[a-z]{2}$/i.test(iso2 || "")) return "";
  return [...iso2.toUpperCase()].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("");
}
