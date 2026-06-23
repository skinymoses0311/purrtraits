// Static list of common cat breeds for the breed-search input. Curated
// from the CFA primary breed list with four catch-all buckets so non-
// purebred cats aren't stuck. TICA extensions can be added later; v1 is
// CFA-only. NOTE: no "Other / Unsure" entry — cats use the closed-list
// only; the "I'm not sure" radio in the breed step still covers the
// unknown case.

export const CAT_BREEDS: string[] = [
  // Catch-alls first — typeahead surfaces these when the user types
  // "domestic", "mixed", etc. or has a non-pedigree cat.
  "Domestic Shorthair",
  "Domestic Medium Hair",
  "Domestic Longhair",
  "Mixed breed",

  // CFA primary list (alphabetical)
  "Abyssinian",
  "American Bobtail",
  "American Curl",
  "American Shorthair",
  "American Wirehair",
  "Balinese",
  "Bengal",
  "Birman",
  "Bombay",
  "British Shorthair",
  "Burmese",
  "Burmilla",
  "Chartreux",
  "Colorpoint Shorthair",
  "Cornish Rex",
  "Cymric",
  "Devon Rex",
  "Egyptian Mau",
  "European Burmese",
  "Exotic Shorthair",
  "Havana Brown",
  "Japanese Bobtail",
  "Khao Manee",
  "Korat",
  "LaPerm",
  "Lykoi",
  "Maine Coon",
  "Manx",
  "Norwegian Forest Cat",
  "Ocicat",
  "Oriental Longhair",
  "Oriental Shorthair",
  "Persian",
  "Pixiebob",
  "Ragamuffin",
  "Ragdoll",
  "Russian Blue",
  "Selkirk Rex",
  "Siamese",
  "Siberian",
  "Singapura",
  "Somali",
  "Sphynx",
  "Tonkinese",
  "Toybob",
  "Turkish Angora",
  "Turkish Van",

  // Designer / TICA extras (alphabetical)
  "Bengal / Savannah mix",
  "Savannah",
  "Snowshoe",
  "Sokoke",
  "Tiffanie",
  "Toyger",
  "Ukrainian Levkoy",
];