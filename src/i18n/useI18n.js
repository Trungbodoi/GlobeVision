import { useContext } from "react";
import { I18nContext } from "./I18nContext";

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n phải được dùng bên trong I18nProvider");
  }

  return context;
}
