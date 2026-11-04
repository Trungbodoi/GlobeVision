export const FEATURE_GROUPS = [
  { id: "explore", icon: "Compass", labelKey: "home.group.explore" },
  { id: "compare", icon: "ChartNoAxesColumn", labelKey: "home.group.compare" },
  { id: "learn", icon: "GraduationCap", labelKey: "home.group.learn" },
  { id: "maps", icon: "MapPinned", labelKey: "home.group.maps" },
  { id: "settings", icon: "Share2", labelKey: "home.group.settings" },
];

const feature = (id, group, icon, key, status = "available", href = "/globe", query, action) => ({
  id,
  group,
  icon,
  titleKey: `home.feature.${key}.title`,
  descriptionKey: `home.feature.${key}.description`,
  status,
  href: status === "available" ? href : undefined,
  query: status === "available" ? query : undefined,
  action: status === "available" ? action : undefined,
});

export const FEATURES = [
  feature("globe", "explore", "Globe2", "globe"),
  feature("country-search", "explore", "Search", "countrySearch", "available", "/", undefined, "focusCountrySearch"),
  feature("country-profile", "explore", "Map", "countryProfile"),
  feature("neighbors", "explore", "UsersRound", "neighbors"),
  feature("comparison", "compare", "ChartNoAxesColumn", "comparison"),
  feature("quiz", "learn", "Lightbulb", "quiz", "available", "/globe", { quiz: "all" }),
  feature("daily-challenge", "learn", "CalendarDays", "dailyChallenge", "available", "/globe", { quiz: "all", intent: "daily" }),
  feature("flashcards", "learn", "BookOpenCheck", "flashcards", "available", "/globe", { intent: "flashcards" }),
  feature("learning-paths", "learn", "Route", "learningPaths", "available", "/globe", { intent: "paths" }),
  feature("learning-progress", "learn", "BarChart3", "learningProgress", "available", "/globe", { intent: "progress" }),
  feature("choropleth", "maps", "Layers3", "choropleth", "available", "/globe", { metric: "population" }),
  feature("geographic-layers", "maps", "MapPinned", "geographicLayers", "available", "/globe", { layer: "rivers" }),
  feature("world-clocks", "maps", "Timer", "worldClocks", "available", "/globe", { layers: "capitals" }),
  feature("distance", "maps", "Ruler", "distance"),
  feature("facts", "maps", "Lightbulb", "facts"),
  feature("share-links", "settings", "Share2", "shareLinks"),
  feature("language", "settings", "Languages", "language", "available", "/", undefined, "toggleLanguage"),
  feature("theme", "settings", "Sun", "theme", "available", "/", undefined, "toggleTheme"),
  feature("lite-offline", "settings", "Zap", "liteOffline"),
  feature("classroom-assignments", "learn", "GraduationCap", "classroomAssignments", "soon"),
  feature("climate-maps", "maps", "CloudSun", "climateMaps", "soon"),
  feature("export-reports", "settings", "ArrowUpRight", "exportReports", "soon"),
];

export const INTENTS = [
  {
    id: "explore-country",
    featureId: "country-search",
    icon: "Search",
    titleKey: "home.intent.explore.title",
    descriptionKey: "home.intent.explore.description",
  },
  {
    id: "compare-countries",
    featureId: "comparison",
    icon: "ChartNoAxesColumn",
    titleKey: "home.intent.compare.title",
    descriptionKey: "home.intent.compare.description",
  },
  {
    id: "learn-geography",
    featureId: "quiz",
    icon: "GraduationCap",
    titleKey: "home.intent.learn.title",
    descriptionKey: "home.intent.learn.description",
  },
  {
    id: "view-map-data",
    featureId: "choropleth",
    icon: "Layers3",
    titleKey: "home.intent.maps.title",
    descriptionKey: "home.intent.maps.description",
  },
];
