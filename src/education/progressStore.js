import { reviewCard } from "./srs.js";
import { getLocalDateKey, getPreviousLocalDateKey } from "./dateKey.js";

const STORAGE_KEY = "globevision.learningProgress";
const VERSION = 1;

export function createEmptyProgress() {
  return {
    version: VERSION,
    cards: {},
    stats: {
      totalAnswered: 0,
      totalCorrect: 0,
      streak: 0,
      lastStudyDate: null,
      learnedCountryIds: [],
    },
    badges: [],
  };
}

export function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyProgress();

  const parsed = JSON.parse(raw);
  if (
    parsed?.version !== VERSION ||
    !parsed.cards ||
    typeof parsed.cards !== "object" ||
    !parsed.stats ||
    !Array.isArray(parsed.stats.learnedCountryIds) ||
    !Array.isArray(parsed.badges)
  ) {
    throw new Error("Saved learning progress has an unsupported or invalid format.");
  }

  return parsed;
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function recordAnswer(progress, countryId, correct, now = Date.now()) {
  const next = structuredClone(progress);
  const today = getLocalDateKey(new Date(now));
  const yesterday = getPreviousLocalDateKey(new Date(now));
  const previousDate = next.stats.lastStudyDate;

  next.stats.totalAnswered += 1;
  next.stats.totalCorrect += Number(correct);
  if (!previousDate) next.stats.streak = 1;
  else if (previousDate !== today) {
    next.stats.streak = previousDate === yesterday ? next.stats.streak + 1 : 1;
  }
  next.stats.lastStudyDate = today;

  const priorCard = next.cards[countryId];
  next.cards[countryId] = reviewCard(priorCard, correct, now);
  if (next.cards[countryId].box >= 3 && !next.stats.learnedCountryIds.includes(countryId)) {
    next.stats.learnedCountryIds.push(countryId);
  }

  const earned = [];
  if (next.stats.totalAnswered >= 1) earned.push("first-answer");
  if (next.stats.learnedCountryIds.length >= 10) earned.push("ten-countries");
  if (next.stats.totalAnswered >= 10 && next.stats.totalCorrect / next.stats.totalAnswered >= 0.9) {
    earned.push("accuracy");
  }
  next.badges = [...new Set([...next.badges, ...earned])];

  return next;
}

export function exportProgress(progress) {
  return JSON.stringify({ ...progress, exportedAt: new Date().toISOString() }, null, 2);
}

export function importProgress(json) {
  const parsed = JSON.parse(json);
  if (
    parsed?.version !== VERSION ||
    !parsed.cards ||
    typeof parsed.cards !== "object" ||
    !parsed.stats ||
    !Array.isArray(parsed.stats.learnedCountryIds) ||
    !Array.isArray(parsed.badges)
  ) {
    throw new Error("The selected file is not a valid GlobeVision learning backup.");
  }

  return {
    version: VERSION,
    cards: parsed.cards,
    stats: parsed.stats,
    badges: parsed.badges,
  };
}
