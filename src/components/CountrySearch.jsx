import { useId, useMemo, useRef, useState } from "react";
import { getCountryName, searchCountries } from "../data/countries";
import { useI18n } from "../i18n/useI18n";
import Icon from "./Icon";
import "./CountrySearch.css";

function CountrySearch({
  countries,
  onSelect,
  variant = "globe",
  showLanguageToggle = true,
  onHome,
  inputId,
}) {
  const { lang, setLang, t, place } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const results = useMemo(
    () => searchCountries(countries, query, lang),
    [countries, query, lang]
  );

  const showList = open && query.trim() !== "";

  function choose(country) {
    if (!country) return;

    onSelect(country.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  }

  return (
    <div className={`globe-toolbar${variant === "landing" ? " is-landing" : ""}`}>
      <div className="country-search">
        <Icon className="country-search-icon" name="Search" size={19} />

        <input
          ref={inputRef}
          id={inputId}
          type="search"
          className="country-search-input"
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />

        {showList && (
          <ul id={listId} className="country-search-list" role="listbox">
            {results.length === 0 ? (
              <li className="country-search-empty">{t("search.noResults")}</li>
            ) : (
              results.map((country, index) => (
                <li
                  key={country.id}
                  id={`${listId}-${country.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={
                    "country-search-option" + (index === activeIndex ? " is-active" : "")
                  }
                  // mousedown chạy trước blur của ô nhập
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(country);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="country-search-name">{getCountryName(country, lang)}</span>
                  <span className="country-search-meta">
                    {lang === "vi" && country.nameVi !== country.nameEn && (
                      <>{country.nameEn} · </>
                    )}
                    {place(country.continent)}
                  </span>
                  <span className="country-search-code">{country.iso2 || country.id}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {onHome && (
        <button
          type="button"
          className="country-home-button"
          onClick={onHome}
          aria-label={t("home.nav.home")}
          title={t("home.nav.home")}
        >
          <Icon name="Home" size={19} />
          <span>{t("home.nav.home")}</span>
        </button>
      )}

      {showLanguageToggle && (
        <button
          type="button"
          className="language-toggle"
          onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          aria-label={t("app.languageSwitch")}
          title={t("app.languageSwitch")}
        >
          <span className={lang === "vi" ? "is-current" : ""}>VI</span>
          <span className={lang === "en" ? "is-current" : ""}>EN</span>
        </button>
      )}
    </div>
  );
}

export default CountrySearch;
