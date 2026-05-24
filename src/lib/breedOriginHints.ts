// Breed → name-origin pre-select hint for step 3 of the name generator.
//
// Only breeds with a strong, single national/linguistic origin are included.
// Mixed-origin or breeds with no clear cultural tie deliberately have no entry
// — the brief calls for the hint to be skipped in those cases.
//
// Keys are lower-cased breed names; use the helper rather than direct lookup
// so casing and "Inu/Spaniel" suffix differences in the breed list don't
// silently miss.

import type { NameOriginKey } from "./dogNames";

const HINTS: Record<string, NameOriginKey> = {
  // East Asian
  "akita":               "east-asian",
  "shiba inu":           "east-asian",
  "japanese chin":       "east-asian",
  "japanese spitz":      "east-asian",
  "tosa":                "east-asian",
  "kishu":               "east-asian",
  "chow chow":           "east-asian",
  "shar pei":            "east-asian",
  "chinese crested":     "east-asian",
  "pekingese":           "east-asian",
  "lhasa apso":          "east-asian",
  "tibetan terrier":     "east-asian",
  "tibetan spaniel":     "east-asian",
  "pug":                 "east-asian",

  // Celtic
  "irish setter":              "celtic",
  "irish red setter":          "celtic",
  "irish wolfhound":           "celtic",
  "irish terrier":             "celtic",
  "irish water spaniel":       "celtic",
  "kerry blue terrier":        "celtic",
  "scottish terrier":          "celtic",
  "scottish deerhound":        "celtic",
  "skye terrier":              "celtic",
  "west highland white terrier": "celtic",
  "cairn terrier":             "celtic",
  "border collie":             "celtic",
  "welsh corgi":               "celtic",
  "pembroke welsh corgi":      "celtic",
  "cardigan welsh corgi":      "celtic",
  "welsh terrier":             "celtic",
  "welsh springer spaniel":    "celtic",

  // Romance (French / Spanish / Italian)
  "french bulldog":            "romance",
  "papillon":                  "romance",
  "bichon frise":              "romance",
  "briard":                    "romance",
  "beauceron":                 "romance",
  "basset hound":              "romance",
  "bouvier des flandres":      "romance",
  "italian greyhound":         "romance",
  "neapolitan mastiff":        "romance",
  "bergamasco":                "romance",
  "lagotto romagnolo":         "romance",
  "maltese":                   "romance",
  "spinone italiano":          "romance",
  "cane corso":                "romance",
  "bracco italiano":           "romance",
  "spanish water dog":         "romance",
  "ibizan hound":              "romance",
  "portuguese water dog":      "romance",

  // English & Germanic
  "english springer spaniel":  "english-germanic",
  "english setter":            "english-germanic",
  "english cocker spaniel":    "english-germanic",
  "english bulldog":           "english-germanic",
  "english pointer":           "english-germanic",
  "english shepherd":          "english-germanic",
  "old english sheepdog":      "english-germanic",
  "yorkshire terrier":         "english-germanic",
  "staffordshire bull terrier": "english-germanic",
  "labrador retriever":        "english-germanic",
  "golden retriever":          "english-germanic",
  "great dane":                "english-germanic",
  "german shepherd":           "english-germanic",
  "german shorthaired pointer": "english-germanic",
  "german wirehaired pointer": "english-germanic",
  "dachshund":                 "english-germanic",
  "rottweiler":                "english-germanic",
  "doberman pinscher":         "english-germanic",
  "weimaraner":                "english-germanic",
  "schnauzer":                 "english-germanic",
  "miniature schnauzer":       "english-germanic",
  "giant schnauzer":           "english-germanic",
  "boxer":                     "english-germanic",
  "leonberger":                "english-germanic",
  "affenpinscher":             "english-germanic",

  // Slavic
  "samoyed":                   "slavic",
  "siberian husky":            "slavic",
  "russian toy":               "slavic",
  "borzoi":                    "slavic",
  "central asian shepherd":    "slavic",
  "polish lowland sheepdog":   "slavic",
  "polish hound":              "slavic",
  "black russian terrier":     "slavic",
  "ovcharka":                  "slavic",

  // Arabic & Middle Eastern
  "saluki":                    "arabic",
  "afghan hound":              "arabic",
  "azawakh":                   "arabic",
  "anatolian shepherd":        "arabic",
  "canaan dog":                "arabic",
  "sloughi":                   "arabic",
};

export function originHintForBreed(breed: string | undefined): NameOriginKey | null {
  if (!breed) return null;
  return HINTS[breed.toLowerCase()] ?? null;
}

// For crossbreeds (multiple). Returns a hint only when every contributing
// breed maps to the same origin — mixed origins are explicitly skipped per
// the brief.
export function originHintForBreeds(breeds: string[] | undefined): NameOriginKey | null {
  if (!breeds || breeds.length === 0) return null;
  const hints = breeds.map((b) => originHintForBreed(b));
  if (hints.some((h) => h === null)) return null;
  const first = hints[0];
  if (hints.every((h) => h === first)) return first;
  return null;
}
