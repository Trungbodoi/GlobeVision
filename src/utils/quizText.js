import { getCountryNameByLang } from "../data/quiz";

// Nội dung câu hỏi cho giáo viên xem (xem trước đề, thống kê).
export function questionText(question, lang, t) {
  const name = getCountryNameByLang(question, lang);

  if (question.kind === "locate") return t("quiz.prompt.locate", { name });
  if (question.kind === "capital") return t("quiz.prompt.capital", { name });
  if (question.kind === "flag") return `${t("quiz.prompt.flag")} (${name})`;

  return question.prompt;
}

export function questionAnswer(question, lang) {
  if (question.kind === "custom_choice") return question.correct_label;
  if (question.kind === "capital") return question.capital;

  return getCountryNameByLang(question, lang);
}
