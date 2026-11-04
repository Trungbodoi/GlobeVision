const ORGANIZATIONS = {
  asean: {
    ids: ["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "VN"],
  },
  eu: {
    ids: [
      "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
      "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
      "SI", "ES", "SE",
    ],
  },
  g20: {
    ids: [
      "AR", "AU", "BR", "CA", "CN", "FR", "DE", "IN", "ID", "IT", "JP", "KR",
      "MX", "RU", "SA", "ZA", "TR", "GB", "US",
    ],
  },
  un: {
    ids: [
      "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ", "BS",
      "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BT", "BO", "BA", "BW", "BR",
      "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "CF", "TD", "CL", "CN",
      "CO", "KM", "CG", "CR", "CI", "HR", "CU", "CY", "CZ", "KP", "CD", "DK",
      "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ",
      "FI", "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN", "GW",
      "GY", "HT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT",
      "JM", "JP", "JO", "KZ", "KE", "KI", "KW", "KG", "LA", "LV", "LB", "LS",
      "LR", "LY", "LI", "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT", "MH",
      "MR", "MU", "MX", "FM", "MC", "MN", "ME", "MA", "MZ", "MM", "NA", "NR",
      "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO", "OM", "PK", "PW", "PA",
      "PG", "PY", "PE", "PH", "PL", "PT", "QA", "KR", "MD", "RO", "RU", "RW",
      "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG",
      "SK", "SI", "SB", "SO", "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH",
      "SY", "TJ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM", "TV", "UG",
      "UA", "AE", "GB", "TZ", "US", "UY", "UZ", "VU", "VE", "VN", "YE", "ZM",
      "ZW",
    ],
  },
  africanUnion: {
    ids: [
      "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG",
      "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN",
      "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ",
      "NA", "NE", "NG", "RW", "EH", "ST", "SN", "SC", "SL", "SO", "ZA", "SS",
      "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
    ],
  },
  landlocked: {
    ids: [
      "AF", "AD", "AM", "AT", "AZ", "BY", "BT", "BO", "BW", "BF", "BI", "CF",
      "TD", "CZ", "SZ", "ET", "HU", "KZ", "KG", "LA", "LS", "LI", "LU", "MK",
      "MW", "ML", "MD", "MN", "NP", "NE", "PY", "RW", "SM", "RS", "SK", "SS",
      "CH", "TJ", "TM", "UG", "UZ", "VA", "ZM", "ZW",
    ],
  },
  island: {
    ids: [
      "AG", "BS", "BH", "BB", "BN", "CV", "KM", "CU", "CY", "DM", "DO", "FJ",
      "GD", "ID", "IE", "JM", "JP", "KI", "MG", "MV", "MT", "MH", "MU", "FM",
      "NR", "NZ", "PW", "PG", "PH", "KN", "LC", "VC", "WS", "ST", "SC", "SG",
      "SB", "LK", "TL", "TO", "TT", "TV", "GB", "VU",
    ],
  },
};

export const GROUP_OPTIONS = [
  { id: "none", labelKey: "explorer.group.none" },
  { id: "asean", labelKey: "explorer.group.asean" },
  { id: "eu", labelKey: "explorer.group.eu" },
  { id: "g20", labelKey: "explorer.group.g20" },
  { id: "un", labelKey: "explorer.group.un" },
  { id: "africanUnion", labelKey: "explorer.group.africanUnion" },
  { id: "landlocked", labelKey: "explorer.group.landlocked" },
  { id: "island", labelKey: "explorer.group.island" },
];

export function getGroupCountryIds(groupId) {
  return new Set(ORGANIZATIONS[groupId]?.ids ?? []);
}

export function getGroupIds() {
  return Object.keys(ORGANIZATIONS);
}
