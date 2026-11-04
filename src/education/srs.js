const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

export function reviewCard(card, correct, now = Date.now()) {
  const box = correct ? Math.min((card?.box ?? 0) + 1, BOX_INTERVAL_DAYS.length - 1) : 1;
  const intervalDays = correct ? BOX_INTERVAL_DAYS[box] : 0;

  return {
    box,
    dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
    seen: (card?.seen ?? 0) + 1,
    correct: (card?.correct ?? 0) + Number(correct),
    updatedAt: now,
  };
}

export function selectDueCards(cards, now = Date.now()) {
  return Object.entries(cards)
    .filter(([, card]) => card.dueAt <= now)
    .sort(([, first], [, second]) => first.dueAt - second.dueAt)
    .map(([countryId]) => countryId);
}
