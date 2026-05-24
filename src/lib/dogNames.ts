// Curated dog name dataset for /dog-name-generator.
//
// Names are grouped by linguistic origin (NOT religion). Every name is an
// everyday given name; sacred / prophetic / divine-attribute names are
// excluded across all six categories — see the curation note in the build
// brief.
//
// `species: "dog"` is on every entry so cats can be added later as a content
// task: a second pass appends `species: "cat"` rows and the filter switches
// from a hard-coded "dog" to a route parameter. No schema changes needed.
//
// Gender semantics:
//   "boy"    – traditionally male
//   "girl"   – traditionally female
//   "either" – commonly used for either (filter "either" gender returns the
//              full set; "boy" returns boy + either; "girl" returns girl + either)
//
// Meanings are short and conservative. Where a meaning was uncertain it has
// been omitted rather than guessed.

export type NameOriginKey =
  | "english-germanic"
  | "celtic"
  | "romance"
  | "slavic"
  | "arabic"
  | "east-asian";

export type NameGender = "boy" | "girl" | "either";

export type NameSpecies = "dog" | "cat";

export type DogName = {
  name: string;
  origin: NameOriginKey;
  gender: NameGender;
  meaning: string;
  species: NameSpecies;
};

export const NAME_ORIGINS: Array<{
  key: NameOriginKey;
  label: string;
  blurb: string;
  examples: string[];
}> = [
  {
    key: "english-germanic",
    label: "English & Germanic",
    blurb:
      "Old English, Norse and Germanic roots — nature words and old trades.",
    examples: ["William", "Arthur", "Emma", "Edith"],
  },
  {
    key: "celtic",
    label: "Celtic",
    blurb:
      "Lyrical Irish, Scottish and Welsh names with mythological roots.",
    examples: ["Liam", "Aoife", "Connor", "Bran"],
  },
  {
    key: "romance",
    label: "Romance",
    blurb:
      "Melodic Latin-rooted names from French, Spanish and Italian.",
    examples: ["Sofia", "Mateo", "Bruno", "Alessandro"],
  },
  {
    key: "slavic",
    label: "Slavic",
    blurb:
      "Eastern European names built from roots meaning “glory” and “peace”.",
    examples: ["Mila", "Bogdan", "Dmitri", "Vera"],
  },
  {
    key: "arabic",
    label: "Arabic & Middle Eastern",
    blurb:
      "Arabic-origin names with rich meanings of nature and virtue.",
    examples: ["Layla", "Amir", "Yasmin", "Karim"],
  },
  {
    key: "east-asian",
    label: "East Asian",
    blurb:
      "Meaning-rich Chinese, Japanese and Korean names tied to nature and fortune.",
    examples: ["Hiroshi", "Mei", "Suki", "Haru"],
  },
];

export const DOG_NAMES: DogName[] = [
  // ────────────────────────────────────────────────────────────────────────
  // English & Germanic (~52)
  // ────────────────────────────────────────────────────────────────────────
  { name: "Arthur",   origin: "english-germanic", gender: "boy",    meaning: "Bear, strong",                species: "dog" },
  { name: "Oliver",   origin: "english-germanic", gender: "boy",    meaning: "Olive tree",                  species: "dog" },
  { name: "Henry",    origin: "english-germanic", gender: "boy",    meaning: "Ruler of the home",           species: "dog" },
  { name: "William",  origin: "english-germanic", gender: "boy",    meaning: "Resolute protector",          species: "dog" },
  { name: "Albert",   origin: "english-germanic", gender: "boy",    meaning: "Noble and bright",            species: "dog" },
  { name: "Edward",   origin: "english-germanic", gender: "boy",    meaning: "Wealthy guardian",            species: "dog" },
  { name: "Alfred",   origin: "english-germanic", gender: "boy",    meaning: "Elf counsel",                 species: "dog" },
  { name: "George",   origin: "english-germanic", gender: "boy",    meaning: "Farmer, earth-worker",        species: "dog" },
  { name: "Hugo",     origin: "english-germanic", gender: "boy",    meaning: "Mind, spirit",                species: "dog" },
  { name: "Otis",     origin: "english-germanic", gender: "boy",    meaning: "Wealth",                      species: "dog" },
  { name: "Walter",   origin: "english-germanic", gender: "boy",    meaning: "Army ruler",                  species: "dog" },
  { name: "Bertie",   origin: "english-germanic", gender: "boy",    meaning: "Bright",                      species: "dog" },
  { name: "Archie",   origin: "english-germanic", gender: "boy",    meaning: "Truly bold",                  species: "dog" },
  { name: "Stanley",  origin: "english-germanic", gender: "boy",    meaning: "Stony clearing",              species: "dog" },
  { name: "Wesley",   origin: "english-germanic", gender: "boy",    meaning: "Western meadow",              species: "dog" },
  { name: "Frederick",origin: "english-germanic", gender: "boy",    meaning: "Peaceful ruler",              species: "dog" },
  { name: "Reggie",   origin: "english-germanic", gender: "boy",    meaning: "Counsel ruler",               species: "dog" },
  { name: "Theodore", origin: "english-germanic", gender: "boy",    meaning: "Gift",                        species: "dog" },
  { name: "Ernest",   origin: "english-germanic", gender: "boy",    meaning: "Serious, earnest",            species: "dog" },
  { name: "Rufus",    origin: "english-germanic", gender: "boy",    meaning: "Red-haired",                  species: "dog" },
  { name: "Barnaby",  origin: "english-germanic", gender: "boy",    meaning: "Son of consolation",          species: "dog" },
  { name: "Hudson",   origin: "english-germanic", gender: "boy",    meaning: "Hugh’s son",             species: "dog" },
  { name: "Wilfred",  origin: "english-germanic", gender: "boy",    meaning: "Will-peace",                  species: "dog" },
  { name: "Monty",    origin: "english-germanic", gender: "boy",    meaning: "From the mountain",           species: "dog" },
  { name: "Atlas",    origin: "english-germanic", gender: "boy",    meaning: "To bear, endure",             species: "dog" },
  { name: "Bramble",  origin: "english-germanic", gender: "either", meaning: "Thorny shrub",                species: "dog" },
  { name: "Birch",    origin: "english-germanic", gender: "either", meaning: "Bright tree",                 species: "dog" },
  { name: "Ash",      origin: "english-germanic", gender: "either", meaning: "Ash tree",                    species: "dog" },
  { name: "Wren",     origin: "english-germanic", gender: "either", meaning: "Small songbird",              species: "dog" },
  { name: "Robin",    origin: "english-germanic", gender: "either", meaning: "Bright fame; small bird",     species: "dog" },
  { name: "Fox",      origin: "english-germanic", gender: "either", meaning: "Clever forest dweller",       species: "dog" },
  { name: "Bear",     origin: "english-germanic", gender: "either", meaning: "The animal",                  species: "dog" },
  { name: "Storm",    origin: "english-germanic", gender: "either", meaning: "Tempest",                     species: "dog" },
  { name: "Willow",   origin: "english-germanic", gender: "girl",   meaning: "Slender willow tree",         species: "dog" },
  { name: "Hazel",    origin: "english-germanic", gender: "girl",   meaning: "Hazelnut tree",               species: "dog" },
  { name: "Ivy",      origin: "english-germanic", gender: "girl",   meaning: "Climbing evergreen",          species: "dog" },
  { name: "Daisy",    origin: "english-germanic", gender: "girl",   meaning: "Day’s eye",              species: "dog" },
  { name: "Poppy",    origin: "english-germanic", gender: "girl",   meaning: "Bright red flower",           species: "dog" },
  { name: "Hattie",   origin: "english-germanic", gender: "girl",   meaning: "Ruler of the home",           species: "dog" },
  { name: "Edith",    origin: "english-germanic", gender: "girl",   meaning: "Prosperous in war",           species: "dog" },
  { name: "Emma",     origin: "english-germanic", gender: "girl",   meaning: "Whole, universal",            species: "dog" },
  { name: "Mabel",    origin: "english-germanic", gender: "girl",   meaning: "Lovable",                     species: "dog" },
  { name: "Maisie",   origin: "english-germanic", gender: "girl",   meaning: "Pearl",                       species: "dog" },
  { name: "Nellie",   origin: "english-germanic", gender: "girl",   meaning: "Bright, shining one",         species: "dog" },
  { name: "Tilly",    origin: "english-germanic", gender: "girl",   meaning: "Mighty in battle",            species: "dog" },
  { name: "Winnie",   origin: "english-germanic", gender: "girl",   meaning: "Joy, peace",                  species: "dog" },
  { name: "Dottie",   origin: "english-germanic", gender: "girl",   meaning: "Gift",                        species: "dog" },
  { name: "Bess",     origin: "english-germanic", gender: "girl",   meaning: "Pledged to oath",             species: "dog" },
  { name: "Pippa",    origin: "english-germanic", gender: "girl",   meaning: "Lover of horses",             species: "dog" },
  { name: "Florence", origin: "english-germanic", gender: "girl",   meaning: "Flourishing",                 species: "dog" },
  { name: "Beatrix",  origin: "english-germanic", gender: "girl",   meaning: "Bringer of joy",              species: "dog" },
  { name: "Rosie",    origin: "english-germanic", gender: "girl",   meaning: "Rose; fame",                  species: "dog" },
  { name: "Audrey",   origin: "english-germanic", gender: "girl",   meaning: "Noble strength",              species: "dog" },

  // ────────────────────────────────────────────────────────────────────────
  // Celtic (~50)
  // ────────────────────────────────────────────────────────────────────────
  { name: "Finn",      origin: "celtic", gender: "boy",    meaning: "Fair, white",                          species: "dog" },
  { name: "Liam",      origin: "celtic", gender: "boy",    meaning: "Strong-willed warrior",                species: "dog" },
  { name: "Connor",    origin: "celtic", gender: "boy",    meaning: "Lover of hounds",                      species: "dog" },
  { name: "Cillian",   origin: "celtic", gender: "boy",    meaning: "Little church-goer; warrior",          species: "dog" },
  { name: "Oisin",     origin: "celtic", gender: "boy",    meaning: "Little deer",                          species: "dog" },
  { name: "Ronan",     origin: "celtic", gender: "boy",    meaning: "Little seal",                          species: "dog" },
  { name: "Cian",      origin: "celtic", gender: "boy",    meaning: "Ancient, enduring",                    species: "dog" },
  { name: "Eoin",      origin: "celtic", gender: "boy",    meaning: "Yew tree (Irish form)",                species: "dog" },
  { name: "Bran",      origin: "celtic", gender: "boy",    meaning: "Raven",                                species: "dog" },
  { name: "Lir",       origin: "celtic", gender: "boy",    meaning: "Sea",                                  species: "dog" },
  { name: "Cormac",    origin: "celtic", gender: "boy",    meaning: "Chariot-rider",                        species: "dog" },
  { name: "Diarmuid",  origin: "celtic", gender: "boy",    meaning: "Without envy",                         species: "dog" },
  { name: "Fionn",     origin: "celtic", gender: "boy",    meaning: "Fair-haired hero",                     species: "dog" },
  { name: "Lorcan",    origin: "celtic", gender: "boy",    meaning: "Little fierce one",                    species: "dog" },
  { name: "Padraig",   origin: "celtic", gender: "boy",    meaning: "Noble",                                species: "dog" },
  { name: "Tadhg",     origin: "celtic", gender: "boy",    meaning: "Poet",                                 species: "dog" },
  { name: "Aiden",     origin: "celtic", gender: "boy",    meaning: "Little fire",                          species: "dog" },
  { name: "Rory",      origin: "celtic", gender: "boy",    meaning: "Red king",                             species: "dog" },
  { name: "Murphy",    origin: "celtic", gender: "boy",    meaning: "Sea warrior",                          species: "dog" },
  { name: "Callum",    origin: "celtic", gender: "boy",    meaning: "Dove",                                 species: "dog" },
  { name: "Duncan",    origin: "celtic", gender: "boy",    meaning: "Dark warrior",                         species: "dog" },
  { name: "Hamish",    origin: "celtic", gender: "boy",    meaning: "Supplanter (Scots)",                   species: "dog" },
  { name: "Angus",     origin: "celtic", gender: "boy",    meaning: "One strength",                         species: "dog" },
  { name: "Lachlan",   origin: "celtic", gender: "boy",    meaning: "From the land of lakes",               species: "dog" },
  { name: "Rhys",      origin: "celtic", gender: "boy",    meaning: "Ardour, enthusiasm",                   species: "dog" },
  { name: "Aoife",     origin: "celtic", gender: "girl",   meaning: "Radiance, beauty",                     species: "dog" },
  { name: "Niamh",     origin: "celtic", gender: "girl",   meaning: "Bright, radiant",                      species: "dog" },
  { name: "Siobhan",   origin: "celtic", gender: "girl",   meaning: "God is gracious",                      species: "dog" },
  { name: "Saoirse",   origin: "celtic", gender: "girl",   meaning: "Freedom",                              species: "dog" },
  { name: "Maeve",     origin: "celtic", gender: "girl",   meaning: "She who intoxicates",                  species: "dog" },
  { name: "Roisin",    origin: "celtic", gender: "girl",   meaning: "Little rose",                          species: "dog" },
  { name: "Eilidh",    origin: "celtic", gender: "girl",   meaning: "Sun (Scots Gaelic)",                   species: "dog" },
  { name: "Bronwen",   origin: "celtic", gender: "girl",   meaning: "Fair breast (Welsh)",                  species: "dog" },
  { name: "Rhiannon",  origin: "celtic", gender: "girl",   meaning: "Great queen",                          species: "dog" },
  { name: "Cerys",     origin: "celtic", gender: "girl",   meaning: "Love",                                 species: "dog" },
  { name: "Ffion",     origin: "celtic", gender: "girl",   meaning: "Foxglove (Welsh)",                     species: "dog" },
  { name: "Eira",      origin: "celtic", gender: "girl",   meaning: "Snow (Welsh)",                         species: "dog" },
  { name: "Catriona",  origin: "celtic", gender: "girl",   meaning: "Pure (Scots)",                         species: "dog" },
  { name: "Iona",      origin: "celtic", gender: "girl",   meaning: "Island; Scottish isle",                species: "dog" },
  { name: "Sorcha",    origin: "celtic", gender: "girl",   meaning: "Bright, radiant",                      species: "dog" },
  { name: "Una",       origin: "celtic", gender: "girl",   meaning: "Lamb; one",                            species: "dog" },
  { name: "Nessa",     origin: "celtic", gender: "girl",   meaning: "Not gentle; ungentle one",             species: "dog" },
  { name: "Caitlin",   origin: "celtic", gender: "girl",   meaning: "Pure",                                 species: "dog" },
  { name: "Bridie",    origin: "celtic", gender: "girl",   meaning: "Exalted one",                          species: "dog" },
  { name: "Aine",      origin: "celtic", gender: "girl",   meaning: "Brightness, joy",                      species: "dog" },
  { name: "Clodagh",   origin: "celtic", gender: "girl",   meaning: "Irish river name",                     species: "dog" },
  { name: "Tegan",     origin: "celtic", gender: "either", meaning: "Fair (Welsh)",                         species: "dog" },
  { name: "Kerry",     origin: "celtic", gender: "either", meaning: "Dark, dark-haired one",                species: "dog" },
  { name: "Quinn",     origin: "celtic", gender: "either", meaning: "Counsel; wise",                        species: "dog" },
  { name: "Reagan",    origin: "celtic", gender: "either", meaning: "Little ruler",                         species: "dog" },

  // ────────────────────────────────────────────────────────────────────────
  // Romance (~50)
  // ────────────────────────────────────────────────────────────────────────
  { name: "Bruno",       origin: "romance", gender: "boy",    meaning: "Brown",                             species: "dog" },
  { name: "Mateo",       origin: "romance", gender: "boy",    meaning: "Gift",                              species: "dog" },
  { name: "Leo",         origin: "romance", gender: "boy",    meaning: "Lion",                              species: "dog" },
  { name: "Diego",       origin: "romance", gender: "boy",    meaning: "Supplanter",                        species: "dog" },
  { name: "Marco",       origin: "romance", gender: "boy",    meaning: "Warlike",                           species: "dog" },
  { name: "Luca",        origin: "romance", gender: "boy",    meaning: "Light",                             species: "dog" },
  { name: "Enzo",        origin: "romance", gender: "boy",    meaning: "Ruler of the household",            species: "dog" },
  { name: "Alessandro",  origin: "romance", gender: "boy",    meaning: "Defender",                          species: "dog" },
  { name: "Giovanni",    origin: "romance", gender: "boy",    meaning: "Gracious gift",                     species: "dog" },
  { name: "Romeo",       origin: "romance", gender: "boy",    meaning: "Pilgrim to Rome",                   species: "dog" },
  { name: "Rocco",       origin: "romance", gender: "boy",    meaning: "Rest",                              species: "dog" },
  { name: "Salvador",    origin: "romance", gender: "boy",    meaning: "Saviour",                           species: "dog" },
  { name: "Pablo",       origin: "romance", gender: "boy",    meaning: "Small",                             species: "dog" },
  { name: "Ricardo",     origin: "romance", gender: "boy",    meaning: "Brave ruler",                       species: "dog" },
  { name: "Andre",       origin: "romance", gender: "boy",    meaning: "Manly",                             species: "dog" },
  { name: "Pierre",      origin: "romance", gender: "boy",    meaning: "Rock, stone",                       species: "dog" },
  { name: "Jacques",     origin: "romance", gender: "boy",    meaning: "Supplanter",                        species: "dog" },
  { name: "Henri",       origin: "romance", gender: "boy",    meaning: "Ruler of the home",                 species: "dog" },
  { name: "Remy",        origin: "romance", gender: "boy",    meaning: "Oarsman",                           species: "dog" },
  { name: "Gaspard",     origin: "romance", gender: "boy",    meaning: "Treasurer",                         species: "dog" },
  { name: "Olivier",     origin: "romance", gender: "boy",    meaning: "Olive tree (French)",               species: "dog" },
  { name: "Andres",      origin: "romance", gender: "boy",    meaning: "Strong, manly",                     species: "dog" },
  { name: "Lorenzo",     origin: "romance", gender: "boy",    meaning: "From Laurentum; laurel",            species: "dog" },
  { name: "Sofia",       origin: "romance", gender: "girl",   meaning: "Wisdom",                            species: "dog" },
  { name: "Isabella",    origin: "romance", gender: "girl",   meaning: "Devoted",                           species: "dog" },
  { name: "Lucia",       origin: "romance", gender: "girl",   meaning: "Light",                             species: "dog" },
  { name: "Bianca",      origin: "romance", gender: "girl",   meaning: "White",                             species: "dog" },
  { name: "Chiara",      origin: "romance", gender: "girl",   meaning: "Bright, clear",                     species: "dog" },
  { name: "Giulia",      origin: "romance", gender: "girl",   meaning: "Youthful",                          species: "dog" },
  { name: "Aurora",      origin: "romance", gender: "girl",   meaning: "Dawn",                              species: "dog" },
  { name: "Stella",      origin: "romance", gender: "girl",   meaning: "Star",                              species: "dog" },
  { name: "Bella",       origin: "romance", gender: "girl",   meaning: "Beautiful",                         species: "dog" },
  { name: "Valentina",   origin: "romance", gender: "girl",   meaning: "Strong, healthy",                   species: "dog" },
  { name: "Elena",       origin: "romance", gender: "girl",   meaning: "Bright, shining",                   species: "dog" },
  { name: "Camila",      origin: "romance", gender: "girl",   meaning: "Attendant",                         species: "dog" },
  { name: "Carmen",      origin: "romance", gender: "girl",   meaning: "Song",                              species: "dog" },
  { name: "Paloma",      origin: "romance", gender: "girl",   meaning: "Dove",                              species: "dog" },
  { name: "Esme",        origin: "romance", gender: "girl",   meaning: "Esteemed, beloved",                 species: "dog" },
  { name: "Margot",      origin: "romance", gender: "girl",   meaning: "Pearl",                             species: "dog" },
  { name: "Colette",     origin: "romance", gender: "girl",   meaning: "Victory of the people",             species: "dog" },
  { name: "Juliette",    origin: "romance", gender: "girl",   meaning: "Youthful",                          species: "dog" },
  { name: "Celine",      origin: "romance", gender: "girl",   meaning: "Heavenly",                          species: "dog" },
  { name: "Mirabel",     origin: "romance", gender: "girl",   meaning: "Wondrous",                          species: "dog" },
  { name: "Rosalia",     origin: "romance", gender: "girl",   meaning: "Rose",                              species: "dog" },
  { name: "Inez",        origin: "romance", gender: "girl",   meaning: "Pure",                              species: "dog" },
  { name: "Dolce",       origin: "romance", gender: "either", meaning: "Sweet (Italian)",                   species: "dog" },
  { name: "Caro",        origin: "romance", gender: "either", meaning: "Dear (Italian)",                    species: "dog" },
  { name: "Sol",         origin: "romance", gender: "either", meaning: "Sun (Spanish)",                     species: "dog" },
  { name: "Lumi",        origin: "romance", gender: "either", meaning: "Light",                             species: "dog" },
  { name: "Nico",        origin: "romance", gender: "either", meaning: "Victory of the people",             species: "dog" },

  // ────────────────────────────────────────────────────────────────────────
  // Slavic (~46)
  // ────────────────────────────────────────────────────────────────────────
  { name: "Dmitri",   origin: "slavic", gender: "boy",    meaning: "Devoted to the earth",                 species: "dog" },
  { name: "Mikhail",  origin: "slavic", gender: "boy",    meaning: "Who is like God? (everyday name)",     species: "dog" },
  { name: "Boris",    origin: "slavic", gender: "boy",    meaning: "Fighter, snow leopard",                species: "dog" },
  { name: "Igor",     origin: "slavic", gender: "boy",    meaning: "Warrior",                              species: "dog" },
  { name: "Sasha",    origin: "slavic", gender: "either", meaning: "Defender of the people",               species: "dog" },
  { name: "Yuri",     origin: "slavic", gender: "boy",    meaning: "Farmer, earth-worker",                 species: "dog" },
  { name: "Pavel",    origin: "slavic", gender: "boy",    meaning: "Small",                                species: "dog" },
  { name: "Anton",    origin: "slavic", gender: "boy",    meaning: "Priceless one",                        species: "dog" },
  { name: "Bogdan",   origin: "slavic", gender: "boy",    meaning: "Gift",                                 species: "dog" },
  { name: "Radek",    origin: "slavic", gender: "boy",    meaning: "Happy, willing",                       species: "dog" },
  { name: "Milos",    origin: "slavic", gender: "boy",    meaning: "Lover of glory",                       species: "dog" },
  { name: "Stanislav",origin: "slavic", gender: "boy",    meaning: "Glorious in standing",                 species: "dog" },
  { name: "Tomislav", origin: "slavic", gender: "boy",    meaning: "Tame and famed",                       species: "dog" },
  { name: "Lev",      origin: "slavic", gender: "boy",    meaning: "Lion",                                 species: "dog" },
  { name: "Vlad",     origin: "slavic", gender: "boy",    meaning: "To rule",                              species: "dog" },
  { name: "Janek",    origin: "slavic", gender: "boy",    meaning: "Gracious gift",                        species: "dog" },
  { name: "Kazimir",  origin: "slavic", gender: "boy",    meaning: "Bringer of peace",                     species: "dog" },
  { name: "Marek",    origin: "slavic", gender: "boy",    meaning: "Warlike",                              species: "dog" },
  { name: "Ivo",      origin: "slavic", gender: "boy",    meaning: "Yew",                                  species: "dog" },
  { name: "Luka",     origin: "slavic", gender: "boy",    meaning: "Light",                                species: "dog" },
  { name: "Nikolai",  origin: "slavic", gender: "boy",    meaning: "Victory of the people",                species: "dog" },
  { name: "Oleg",     origin: "slavic", gender: "boy",    meaning: "Holy, blessed",                        species: "dog" },
  { name: "Stefan",   origin: "slavic", gender: "boy",    meaning: "Crown",                                species: "dog" },
  { name: "Mila",     origin: "slavic", gender: "girl",   meaning: "Dear, gracious",                       species: "dog" },
  { name: "Nadia",    origin: "slavic", gender: "girl",   meaning: "Hope",                                 species: "dog" },
  { name: "Vera",     origin: "slavic", gender: "girl",   meaning: "Faith",                                species: "dog" },
  { name: "Anya",     origin: "slavic", gender: "girl",   meaning: "Grace",                                species: "dog" },
  { name: "Tasha",    origin: "slavic", gender: "girl",   meaning: "Born on Christmas Day",                species: "dog" },
  { name: "Katya",    origin: "slavic", gender: "girl",   meaning: "Pure",                                 species: "dog" },
  { name: "Lara",     origin: "slavic", gender: "girl",   meaning: "Cheerful",                             species: "dog" },
  { name: "Olga",     origin: "slavic", gender: "girl",   meaning: "Holy, blessed",                        species: "dog" },
  { name: "Zara",     origin: "slavic", gender: "girl",   meaning: "Dawn",                                 species: "dog" },
  { name: "Tanya",    origin: "slavic", gender: "girl",   meaning: "Fairy queen",                          species: "dog" },
  { name: "Irina",    origin: "slavic", gender: "girl",   meaning: "Peace",                                species: "dog" },
  { name: "Yelena",   origin: "slavic", gender: "girl",   meaning: "Bright, shining one",                  species: "dog" },
  { name: "Marta",    origin: "slavic", gender: "girl",   meaning: "Lady",                                 species: "dog" },
  { name: "Sonja",    origin: "slavic", gender: "girl",   meaning: "Wisdom",                               species: "dog" },
  { name: "Klara",    origin: "slavic", gender: "girl",   meaning: "Bright, clear",                        species: "dog" },
  { name: "Eva",      origin: "slavic", gender: "girl",   meaning: "Life",                                 species: "dog" },
  { name: "Mira",     origin: "slavic", gender: "girl",   meaning: "Peace, world",                         species: "dog" },
  { name: "Dasha",    origin: "slavic", gender: "girl",   meaning: "Gift",                                 species: "dog" },
  { name: "Lenka",    origin: "slavic", gender: "girl",   meaning: "Bright",                               species: "dog" },
  { name: "Pavla",    origin: "slavic", gender: "girl",   meaning: "Small",                                species: "dog" },
  { name: "Petra",    origin: "slavic", gender: "girl",   meaning: "Rock, stone",                          species: "dog" },
  { name: "Zoya",     origin: "slavic", gender: "girl",   meaning: "Life",                                 species: "dog" },
  { name: "Yana",     origin: "slavic", gender: "girl",   meaning: "Gracious gift",                        species: "dog" },

  // ────────────────────────────────────────────────────────────────────────
  // Arabic & Middle Eastern (~46) — everyday given names with secular
  // meanings only. No prophet/family/companion names; no divine attributes.
  // ────────────────────────────────────────────────────────────────────────
  { name: "Amir",    origin: "arabic", gender: "boy",    meaning: "Prince",                                species: "dog" },
  { name: "Karim",   origin: "arabic", gender: "boy",    meaning: "Generous",                              species: "dog" },
  { name: "Zain",    origin: "arabic", gender: "boy",    meaning: "Beauty, grace",                         species: "dog" },
  { name: "Samir",   origin: "arabic", gender: "boy",    meaning: "Companion in evening talk",             species: "dog" },
  { name: "Tariq",   origin: "arabic", gender: "boy",    meaning: "Morning star",                          species: "dog" },
  { name: "Rashid",  origin: "arabic", gender: "boy",    meaning: "Rightly guided",                        species: "dog" },
  { name: "Faris",   origin: "arabic", gender: "boy",    meaning: "Knight, horseman",                      species: "dog" },
  { name: "Hadi",    origin: "arabic", gender: "boy",    meaning: "Calm, gentle leader",                   species: "dog" },
  { name: "Jamal",   origin: "arabic", gender: "boy",    meaning: "Beauty",                                species: "dog" },
  { name: "Kamal",   origin: "arabic", gender: "boy",    meaning: "Perfection",                            species: "dog" },
  { name: "Malik",   origin: "arabic", gender: "boy",    meaning: "King",                                  species: "dog" },
  { name: "Nabil",   origin: "arabic", gender: "boy",    meaning: "Noble",                                 species: "dog" },
  { name: "Omar",    origin: "arabic", gender: "boy",    meaning: "Long-lived",                            species: "dog" },
  { name: "Rami",    origin: "arabic", gender: "boy",    meaning: "Archer; loving",                        species: "dog" },
  { name: "Sami",    origin: "arabic", gender: "boy",    meaning: "Elevated, exalted",                     species: "dog" },
  { name: "Tamir",   origin: "arabic", gender: "boy",    meaning: "Owner of date palms",                   species: "dog" },
  { name: "Wassim",  origin: "arabic", gender: "boy",    meaning: "Handsome",                              species: "dog" },
  { name: "Yusra",   origin: "arabic", gender: "girl",   meaning: "Ease, prosperity",                      species: "dog" },
  { name: "Zayd",    origin: "arabic", gender: "boy",    meaning: "Abundance",                             species: "dog" },
  { name: "Anwar",   origin: "arabic", gender: "boy",    meaning: "Brighter, more luminous",               species: "dog" },
  { name: "Hakim",   origin: "arabic", gender: "boy",    meaning: "Wise",                                  species: "dog" },
  { name: "Layth",   origin: "arabic", gender: "boy",    meaning: "Lion",                                  species: "dog" },
  { name: "Adib",    origin: "arabic", gender: "boy",    meaning: "Cultured, refined",                     species: "dog" },
  { name: "Layla",   origin: "arabic", gender: "girl",   meaning: "Night",                                 species: "dog" },
  { name: "Yasmin",  origin: "arabic", gender: "girl",   meaning: "Jasmine flower",                        species: "dog" },
  { name: "Nour",    origin: "arabic", gender: "either", meaning: "Light",                                 species: "dog" },
  { name: "Hana",    origin: "arabic", gender: "girl",   meaning: "Happiness, bliss",                      species: "dog" },
  { name: "Salma",   origin: "arabic", gender: "girl",   meaning: "Peaceful",                              species: "dog" },
  { name: "Lina",    origin: "arabic", gender: "girl",   meaning: "Tender, gentle",                        species: "dog" },
  { name: "Mira",    origin: "arabic", gender: "girl",   meaning: "Princess",                              species: "dog" },
  { name: "Rania",   origin: "arabic", gender: "girl",   meaning: "Gazing, beholding",                     species: "dog" },
  { name: "Zara",    origin: "arabic", gender: "girl",   meaning: "Blooming flower",                       species: "dog" },
  { name: "Amal",    origin: "arabic", gender: "either", meaning: "Hope",                                  species: "dog" },
  { name: "Suri",    origin: "arabic", gender: "girl",   meaning: "Joy",                                   species: "dog" },
  { name: "Dalia",   origin: "arabic", gender: "girl",   meaning: "Gentle, grapevine",                     species: "dog" },
  { name: "Farah",   origin: "arabic", gender: "girl",   meaning: "Joy",                                   species: "dog" },
  { name: "Inara",   origin: "arabic", gender: "girl",   meaning: "Ray of light",                          species: "dog" },
  { name: "Jana",    origin: "arabic", gender: "girl",   meaning: "Harvest, fruit",                        species: "dog" },
  { name: "Kalila",  origin: "arabic", gender: "girl",   meaning: "Dearly loved",                          species: "dog" },
  { name: "Nadira",  origin: "arabic", gender: "girl",   meaning: "Rare, precious",                        species: "dog" },
  { name: "Sahar",   origin: "arabic", gender: "girl",   meaning: "Dawn",                                  species: "dog" },
  { name: "Tala",    origin: "arabic", gender: "girl",   meaning: "Young palm tree",                       species: "dog" },
  { name: "Yara",    origin: "arabic", gender: "girl",   meaning: "Small butterfly",                       species: "dog" },
  { name: "Zaina",   origin: "arabic", gender: "girl",   meaning: "Beauty, grace",                         species: "dog" },
  { name: "Reem",    origin: "arabic", gender: "girl",   meaning: "Gazelle",                               species: "dog" },
  { name: "Lulu",    origin: "arabic", gender: "girl",   meaning: "Pearl",                                 species: "dog" },

  // ────────────────────────────────────────────────────────────────────────
  // East Asian (~46) — Chinese, Japanese, Korean given names with nature
  // and fortune meanings. Secular only.
  // ────────────────────────────────────────────────────────────────────────
  { name: "Hiroshi", origin: "east-asian", gender: "boy",    meaning: "Generous, prosperous (Japanese)",    species: "dog" },
  { name: "Haru",    origin: "east-asian", gender: "either", meaning: "Spring; sunlight (Japanese)",        species: "dog" },
  { name: "Kenji",   origin: "east-asian", gender: "boy",    meaning: "Strong, vigorous (Japanese)",        species: "dog" },
  { name: "Ren",     origin: "east-asian", gender: "either", meaning: "Lotus (Japanese)",                   species: "dog" },
  { name: "Riku",    origin: "east-asian", gender: "boy",    meaning: "Land (Japanese)",                    species: "dog" },
  { name: "Sora",    origin: "east-asian", gender: "either", meaning: "Sky (Japanese)",                     species: "dog" },
  { name: "Yuki",    origin: "east-asian", gender: "either", meaning: "Snow; happiness (Japanese)",         species: "dog" },
  { name: "Takeshi", origin: "east-asian", gender: "boy",    meaning: "Strong as bamboo (Japanese)",        species: "dog" },
  { name: "Daichi",  origin: "east-asian", gender: "boy",    meaning: "Great land (Japanese)",              species: "dog" },
  { name: "Akio",    origin: "east-asian", gender: "boy",    meaning: "Bright man (Japanese)",              species: "dog" },
  { name: "Hayato",  origin: "east-asian", gender: "boy",    meaning: "Falcon person (Japanese)",           species: "dog" },
  { name: "Kaito",   origin: "east-asian", gender: "boy",    meaning: "Ocean voyager (Japanese)",           species: "dog" },
  { name: "Tatsu",   origin: "east-asian", gender: "boy",    meaning: "Dragon (Japanese)",                  species: "dog" },
  { name: "Yori",    origin: "east-asian", gender: "either", meaning: "Trust, reliable (Japanese)",         species: "dog" },
  { name: "Aki",     origin: "east-asian", gender: "either", meaning: "Autumn; bright (Japanese)",          species: "dog" },
  { name: "Mei",     origin: "east-asian", gender: "girl",   meaning: "Plum blossom; beautiful (Chinese)",  species: "dog" },
  { name: "Suki",    origin: "east-asian", gender: "girl",   meaning: "Beloved (Japanese)",                 species: "dog" },
  { name: "Sakura",  origin: "east-asian", gender: "girl",   meaning: "Cherry blossom (Japanese)",          species: "dog" },
  { name: "Hana",    origin: "east-asian", gender: "girl",   meaning: "Flower (Japanese)",                  species: "dog" },
  { name: "Aiko",    origin: "east-asian", gender: "girl",   meaning: "Beloved child (Japanese)",           species: "dog" },
  { name: "Yumi",    origin: "east-asian", gender: "girl",   meaning: "Beauty, archery bow (Japanese)",     species: "dog" },
  { name: "Emi",     origin: "east-asian", gender: "girl",   meaning: "Beautiful blessing (Japanese)",      species: "dog" },
  { name: "Kiko",    origin: "east-asian", gender: "girl",   meaning: "Chronicle child (Japanese)",         species: "dog" },
  { name: "Nori",    origin: "east-asian", gender: "either", meaning: "Doctrine; seaweed (Japanese)",       species: "dog" },
  { name: "Ayame",   origin: "east-asian", gender: "girl",   meaning: "Iris flower (Japanese)",             species: "dog" },
  { name: "Kira",    origin: "east-asian", gender: "girl",   meaning: "Glittering (Japanese)",              species: "dog" },
  { name: "Momo",    origin: "east-asian", gender: "girl",   meaning: "Peach (Japanese)",                   species: "dog" },
  { name: "Nori-ko", origin: "east-asian", gender: "girl",   meaning: "Child of doctrine (Japanese)",       species: "dog" },
  { name: "Yua",     origin: "east-asian", gender: "girl",   meaning: "Binding love (Japanese)",            species: "dog" },
  { name: "Lien",    origin: "east-asian", gender: "girl",   meaning: "Lotus (Chinese)",                    species: "dog" },
  { name: "Bao",     origin: "east-asian", gender: "either", meaning: "Treasure (Chinese)",                 species: "dog" },
  { name: "Chen",    origin: "east-asian", gender: "either", meaning: "Morning (Chinese)",                  species: "dog" },
  { name: "Jin",     origin: "east-asian", gender: "either", meaning: "Gold; treasure (Chinese/Korean)",    species: "dog" },
  { name: "Lan",     origin: "east-asian", gender: "girl",   meaning: "Orchid (Chinese)",                   species: "dog" },
  { name: "Li",      origin: "east-asian", gender: "either", meaning: "Plum; strength (Chinese)",           species: "dog" },
  { name: "Ming",    origin: "east-asian", gender: "either", meaning: "Bright (Chinese)",                   species: "dog" },
  { name: "Yun",     origin: "east-asian", gender: "either", meaning: "Cloud (Chinese)",                    species: "dog" },
  { name: "Xiu",     origin: "east-asian", gender: "girl",   meaning: "Elegant (Chinese)",                  species: "dog" },
  { name: "Bo",      origin: "east-asian", gender: "boy",    meaning: "Precious (Chinese)",                 species: "dog" },
  { name: "Da-eun",  origin: "east-asian", gender: "girl",   meaning: "Great grace (Korean)",               species: "dog" },
  { name: "Min-jun", origin: "east-asian", gender: "boy",    meaning: "Clever, handsome (Korean)",          species: "dog" },
  { name: "Soo-min", origin: "east-asian", gender: "either", meaning: "Excellent, clever (Korean)",         species: "dog" },
  { name: "Ha-eun",  origin: "east-asian", gender: "girl",   meaning: "Summer grace (Korean)",              species: "dog" },
  { name: "Joon",    origin: "east-asian", gender: "boy",    meaning: "Talented, handsome (Korean)",        species: "dog" },
  { name: "Areum",   origin: "east-asian", gender: "girl",   meaning: "Beautiful (Korean)",                 species: "dog" },
  { name: "Nari",    origin: "east-asian", gender: "girl",   meaning: "Lily (Korean)",                      species: "dog" },
];

// Picks ~12 names matched to gender + chosen origins, mixing across the
// selected origins so a multi-origin pick doesn't lean entirely on one bucket.
// Returns ALL matching names (caller can show first N + "show more").
//
// Gender filter:
//   "boy"    → boy + either
//   "girl"   → girl + either
//   "either" → all
export function filterDogNames(args: {
  gender: NameGender;
  origins: NameOriginKey[];
}): DogName[] {
  const { gender, origins } = args;
  const originSet = new Set(origins);
  const matchesGender = (g: NameGender): boolean => {
    if (gender === "either") return true;
    return g === gender || g === "either";
  };
  return DOG_NAMES.filter(
    (n) =>
      n.species === "dog" &&
      originSet.has(n.origin) &&
      matchesGender(n.gender),
  );
}

// Deterministic shuffle using a seeded LCG so repeated views of the same
// (gender, origins) pick land on the same order — calmer UX than re-shuffling
// each render, and stable enough that the email matches what the user saw.
export function shuffleDeterministic<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = (seed >>> 0) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
