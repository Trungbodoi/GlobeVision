import { test } from "vitest";
import assert from "node:assert/strict";
import { LANGUAGES, STRINGS } from "../src/i18n/strings.js";

test("Vietnamese and English dictionaries contain the same complete key set", () => {
  const dictionaries = LANGUAGES.map((language) => Object.keys(STRINGS[language]).sort());
  assert.deepEqual(dictionaries[0], dictionaries[1]);
});
