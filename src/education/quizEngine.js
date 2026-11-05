import { getGroupCountryIds } from "../data/organizations.js";
import { getLocalDateKey } from "./dateKey.js";

const ASEAN_IDS = new Set(["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "VN"]);

export const QUIZ_TYPES = ["find", "flag", "capital", "neighbor"];
export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"];

// Quiz và thẻ ghi nhớ chỉ hỏi về các thành viên Liên Hợp Quốc, không hỏi các vùng
// lãnh thổ phụ thuộc như Åland hay Saint-Martin.
export function getQuizCountries(countries) {
  const members = getGroupCountryIds("un");
  return countries.filter((country) => country.apiCode && members.has(country.id));
}

export function getDailySeed(date = new Date()) {
  const dateKey = date instanceof Date ? getLocalDateKey(date) : String(date);
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

  // Khu vực ít nước thì bộ câu hỏi ngắn lại, không lặp lại cùng một nước.
  const questionCount = Math.min(count, pool.length);
  const random = createSeededRandom(seed);
  const shuffledPool = shuffle(pool, random);
  const mixedTypes = type === "mixed"
    ? shuffle(Array.from({ length: questionCount }, (_, index) => QUIZ_TYPES[index % QUIZ_TYPES.length]), random)
    : null;

  return Array.from({ length: questionCount }, (_, index) => {
    const questionType = mixedTypes ? mixedTypes[index] : type;
    return {
      id: `${seed}-${index}`,
      type: questionType,
      promptCountry: shuffledPool[index],
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

export function needsCountryInfo(question) {
  return question.type === "capital" || question.type === "neighbor";
}

/**
 * Đáp án của câu hỏi thủ đô/láng giềng từ dữ liệu quốc gia lấy qua API.
 * Trả về null khi nước này không hỏi được, ví dụ quốc đảo không có láng giềng.
 * - answerIds: mọi đáp án được tính là đúng (tất cả các nước láng giềng).
 * - shownAnswerId: đáp án đúng duy nhất được đưa vào danh sách lựa chọn.
 */
export function getAnswerFromCountryInfo(question, country, info, countries) {
  if (question.type === "capital") {
    return info?.capital
      ? { answerIds: [country.id], shownAnswerId: country.id, capital: info.capital }
      : null;
  }

  const neighbors = (info?.borders ?? [])
    .map((code) => countries.find((item) => item.iso3 === code))
    .filter((item) => item?.apiCode);
  if (neighbors.length === 0) return null;

  const random = createSeededRandom(question.seed);
  return {
    answerIds: neighbors.map((item) => item.id),
    shownAnswerId: neighbors[Math.floor(random() * neighbors.length)].id,
  };
}

/**
 * Các lựa chọn của câu hỏi: đúng một đáp án đúng, các lựa chọn còn lại chắc chắn
 * sai (không phải nước láng giềng khác, cũng không phải chính nước trong đề).
 */
export function buildQuestionOptions({ countries, region, promptId, answerIds, shownAnswerId, count, seed }) {
  const excluded = new Set([...answerIds, promptId]);
  const pool = countries.filter((country) => country.id === shownAnswerId || !excluded.has(country.id));
  return buildRegionAnswerOptions(pool, region, [shownAnswerId], count, seed);
}

/**
 * Các nước dự phòng khi nước của câu hỏi không có dữ liệu: cùng khu vực, chưa có
 * trong bộ câu hỏi. Thứ tự theo hạt giống để thử thách hằng ngày vẫn giống nhau.
 */
export function getReplacementCountries({ countries, region, questions, seed, limit = 8 }) {
  const usedIds = new Set(questions.map((question) => question.promptCountry.id));
  const pool = filterCountries(countries, region).filter(
    (country) => country.apiCode && !usedIds.has(country.id)
  );
  return shuffle(pool, createSeededRandom(`${seed}-replacement`)).slice(0, limit);
}

// Câu "tìm trên địa cầu" luôn trả lời trên bản đồ: nếu đưa ra lựa chọn thì đề bài
// đã chứa sẵn đáp án. Độ khó cao thì mọi dạng câu đều trả lời trên bản đồ.
export function answersOnGlobe(question) {
  return question.type === "find" || question.difficulty === "hard";
}

// Dùng ảnh thay cho emoji vì Windows hiển thị emoji cờ thành hai chữ cái.
export function getFlagUrl(iso2) {
  if (!/^[a-z]{2}$/i.test(iso2 || "")) return null;
  return `https://flagcdn.com/${iso2.toLowerCase()}.svg`;
}
