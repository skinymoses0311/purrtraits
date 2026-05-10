# Tab 3 — Famous Art reference image manifest

This is the source list for the 30 artworks in the Tab 3 catalog. All images are public domain, sourced from Wikimedia Commons.

## How to use

For each row below:

1. Open the **Wikipedia article URL** to confirm the canonical version of the painting (some artists painted multiple versions — Sunflowers, Mont Sainte-Victoire, Water Lilies — only the listed year/version is the right one).
2. Click the **Direct download** link. This uses the `Special:FilePath` redirect, which serves a 1600px-wide JPEG of the canonical Commons file.
3. Save it to `scripts/artwork-refs/{Target filename}` exactly as listed in the last column. The seed script reads files from this directory by filename.

If a `Special:FilePath` link 404s (canonical filename has changed on Commons), open the Wikipedia article, click the painting, follow through to its Commons File: page, and download the original — then resize to ~1600px on the long edge and save under the listed target filename.

**Resolution target:** ~1600px on the long edge, JPEG quality ~85. ~50MB total across all 30 files. The same file is used both as the catalog card thumbnail and the fal reference image — the browser handles display sizing.

**Aspect ratio:** do not crop to 3:4. Leave the artwork's original aspect ratio intact. Seedream re-frames to 3:4 at generation time.

---

## Manifest

| # | Slug | Title (Artist, Year) | Wikipedia article | Direct download (1600px) | Target filename |
|---|------|----------------------|-------------------|---------------------------|-----------------|
| 1 | `starry_night` | The Starry Night (Van Gogh, 1889) | https://en.wikipedia.org/wiki/The_Starry_Night | https://commons.wikimedia.org/wiki/Special:FilePath/Van%20Gogh%20-%20Starry%20Night%20-%20Google%20Art%20Project.jpg?width=1600 | `starry_night.jpg` |
| 2 | `wheatfield_crows` | Wheatfield with Crows (Van Gogh, 1890) | https://en.wikipedia.org/wiki/Wheatfield_with_Crows | https://commons.wikimedia.org/wiki/Special:FilePath/Vincent%20van%20Gogh%20-%20Wheatfield%20with%20crows%20-%20Google%20Art%20Project.jpg?width=1600 | `wheatfield_crows.jpg` |
| 3 | `cafe_terrace` | The Café Terrace at Night (Van Gogh, 1888) | https://en.wikipedia.org/wiki/Caf%C3%A9_Terrace_at_Night | https://commons.wikimedia.org/wiki/Special:FilePath/Vincent%20Willem%20van%20Gogh%20-%20Caf%C3%A9%20Terrace%20at%20Night%20%28Yorck%29.jpg?width=1600 | `cafe_terrace.jpg` |
| 4 | `sunflowers` | Sunflowers (Van Gogh, 1888 — National Gallery version) | https://en.wikipedia.org/wiki/Sunflowers_(Van_Gogh_series) | https://commons.wikimedia.org/wiki/Special:FilePath/Vincent%20Willem%20van%20Gogh%20-%20Sunflowers%20-%20VGM%20F458.jpg?width=1600 | `sunflowers.jpg` |
| 5 | `bedroom_arles` | Bedroom in Arles (Van Gogh, 1888 — first version) | https://en.wikipedia.org/wiki/Bedroom_in_Arles | https://commons.wikimedia.org/wiki/Special:FilePath/Vincent%20van%20Gogh%20-%20De%20slaapkamer%20-%20Google%20Art%20Project.jpg?width=1600 | `bedroom_arles.jpg` |
| 6 | `impression_sunrise` | Impression, Sunrise (Monet, 1872) | https://en.wikipedia.org/wiki/Impression,_Sunrise | https://commons.wikimedia.org/wiki/Special:FilePath/Monet%20-%20Impression%2C%20Sunrise.jpg?width=1600 | `impression_sunrise.jpg` |
| 7 | `water_lilies_bridge` | Bridge over a Pond of Water Lilies (Monet, 1899) | https://en.wikipedia.org/wiki/Water_Lilies_(Monet_series) | https://commons.wikimedia.org/wiki/Special:FilePath/Claude%20Monet%20-%20Bridge%20over%20a%20Pond%20of%20Water%20Lilies%20-%20The%20Met.jpg?width=1600 | `water_lilies_bridge.jpg` |
| 8 | `poppies_argenteuil` | Poppies near Argenteuil (Monet, 1873) | https://en.wikipedia.org/wiki/Poppies_(Monet) | https://commons.wikimedia.org/wiki/Special:FilePath/Claude%20Monet%20-%20Poppies%20-%20Google%20Art%20Project.jpg?width=1600 | `poppies_argenteuil.jpg` |
| 9 | `the_magpie` | The Magpie (Monet, 1869) | https://en.wikipedia.org/wiki/The_Magpie_(Monet) | https://commons.wikimedia.org/wiki/Special:FilePath/Claude%20Monet%20-%20The%20Magpie%20-%20Google%20Art%20Project.jpg?width=1600 | `the_magpie.jpg` |
| 10 | `houses_parliament_sunset` | Houses of Parliament, Sunset (Monet, 1903) | https://en.wikipedia.org/wiki/Houses_of_Parliament_(Monet_series) | https://commons.wikimedia.org/wiki/Special:FilePath/Claude%20Monet%20-%20Houses%20of%20Parliament%2C%20Sunset.jpg?width=1600 | `houses_parliament_sunset.jpg` |
| 11 | `grande_jatte` | A Sunday on La Grande Jatte (Seurat, 1884) | https://en.wikipedia.org/wiki/A_Sunday_Afternoon_on_the_Island_of_La_Grande_Jatte | https://commons.wikimedia.org/wiki/Special:FilePath/A%20Sunday%20on%20La%20Grande%20Jatte%2C%20Georges%20Seurat%2C%201884.jpg?width=1600 | `grande_jatte.jpg` |
| 12 | `boulevard_montmartre_night` | Boulevard Montmartre at Night (Pissarro, 1897) | https://en.wikipedia.org/wiki/Boulevard_Montmartre_(Pissarro_series) | https://commons.wikimedia.org/wiki/Special:FilePath/Camille%20Pissarro%20-%20Le%20Boulevard%20de%20Montmartre%2C%20effet%20de%20nuit.jpg?width=1600 | `boulevard_montmartre_night.jpg` |
| 13 | `path_long_grass` | Path Climbing through Long Grass (Renoir, 1876) | https://en.wikipedia.org/wiki/Path_Leading_through_Tall_Grass | https://commons.wikimedia.org/wiki/Special:FilePath/Pierre-Auguste%20Renoir%20-%20Chemin%20montant%20dans%20les%20hautes%20herbes.jpg?width=1600 | `path_long_grass.jpg` |
| 14 | `hay_wain` | The Hay Wain (Constable, 1821) | https://en.wikipedia.org/wiki/The_Hay_Wain | https://commons.wikimedia.org/wiki/Special:FilePath/John%20Constable%20The%20Hay%20Wain.jpg?width=1600 | `hay_wain.jpg` |
| 15 | `fighting_temeraire` | The Fighting Temeraire (Turner, 1839) | https://en.wikipedia.org/wiki/The_Fighting_Temeraire | https://commons.wikimedia.org/wiki/Special:FilePath/Turner%2C%20J.%20M.%20W.%20-%20The%20Fighting%20T%C3%A9m%C3%A9raire%20tugged%20to%20her%20last%20Berth%20to%20be%20broken.jpg?width=1600 | `fighting_temeraire.jpg` |
| 16 | `rain_steam_speed` | Rain, Steam and Speed (Turner, 1844) | https://en.wikipedia.org/wiki/Rain,_Steam_and_Speed_%E2%80%93_The_Great_Western_Railway | https://commons.wikimedia.org/wiki/Special:FilePath/Rain%20Steam%20and%20Speed%20the%20Great%20Western%20Railway.jpg?width=1600 | `rain_steam_speed.jpg` |
| 17 | `basket_apples` | Still Life with Basket of Apples (Cézanne, 1895) | https://en.wikipedia.org/wiki/The_Basket_of_Apples | https://commons.wikimedia.org/wiki/Special:FilePath/Paul%20C%C3%A9zanne%20-%20The%20Basket%20of%20Apples%20-%20Google%20Art%20Project.jpg?width=1600 | `basket_apples.jpg` |
| 18 | `mont_sainte_victoire` | Mont Sainte-Victoire (Cézanne, 1904 — Philadelphia version) | https://en.wikipedia.org/wiki/Mont_Sainte-Victoire_(C%C3%A9zanne) | https://commons.wikimedia.org/wiki/Special:FilePath/Paul%20C%C3%A9zanne%20-%20Mont%20Sainte-Victoire%20-%20Google%20Art%20Project.jpg?width=1600 | `mont_sainte_victoire.jpg` |
| 19 | `great_wave` | The Great Wave off Kanagawa (Hokusai, 1831) | https://en.wikipedia.org/wiki/The_Great_Wave_off_Kanagawa | https://commons.wikimedia.org/wiki/Special:FilePath/Tsunami%20by%20hokusai%2019th%20century.jpg?width=1600 | `great_wave.jpg` |
| 20 | `red_fuji` | Fine Wind, Clear Morning / Red Fuji (Hokusai, 1831) | https://en.wikipedia.org/wiki/Fine_Wind,_Clear_Morning | https://commons.wikimedia.org/wiki/Special:FilePath/Red%20Fuji%20southern%20wind%20clear%20morning.jpg?width=1600 | `red_fuji.jpg` |
| 21 | `ejiri_suruga` | Ejiri in Suruga Province (Hokusai, 1832) | https://en.wikipedia.org/wiki/Ejiri_in_Suruga_Province | https://commons.wikimedia.org/wiki/Special:FilePath/Hokusai-fugaku36-ejiri.jpg?width=1600 | `ejiri_suruga.jpg` |
| 22 | `shin_ohashi_shower` | Sudden Shower over Shin-Ōhashi Bridge (Hiroshige, 1857) | https://en.wikipedia.org/wiki/Sudden_Shower_over_Shin-%C5%8Chashi_bridge_and_Atake | https://commons.wikimedia.org/wiki/Special:FilePath/Hiroshige%20Atake%20sous%20une%20averse%20soudaine.jpg?width=1600 | `shin_ohashi_shower.jpg` |
| 23 | `plum_garden_kameido` | Plum Garden in Kameido (Hiroshige, 1857) | https://en.wikipedia.org/wiki/Plum_Park_in_Kameido | https://commons.wikimedia.org/wiki/Special:FilePath/Hiroshige%2C%20Plum%20Park%20in%20Kameido%2C%201857.jpg?width=1600 | `plum_garden_kameido.jpg` |
| 24 | `hunters_snow` | Hunters in the Snow (Bruegel, 1565) | https://en.wikipedia.org/wiki/The_Hunters_in_the_Snow | https://commons.wikimedia.org/wiki/Special:FilePath/Pieter%20Bruegel%20the%20Elder%20-%20Hunters%20in%20the%20Snow%20%28Winter%29%20-%20Google%20Art%20Project.jpg?width=1600 | `hunters_snow.jpg` |
| 25 | `tower_babel` | The Tower of Babel — Vienna (Bruegel, 1563) | https://en.wikipedia.org/wiki/The_Tower_of_Babel_(Bruegel) | https://commons.wikimedia.org/wiki/Special:FilePath/Pieter%20Bruegel%20the%20Elder%20-%20The%20Tower%20of%20Babel%20%28Vienna%29%20-%20Google%20Art%20Project%20-%20edited.jpg?width=1600 | `tower_babel.jpg` |
| 26 | `garden_earthly_delights` | The Garden of Earthly Delights — centre panel (Bosch, c.1500) | https://en.wikipedia.org/wiki/The_Garden_of_Earthly_Delights | https://commons.wikimedia.org/wiki/Special:FilePath/The%20Garden%20of%20earthly%20delights.jpg?width=1600 | `garden_earthly_delights.jpg` |
| 27 | `view_of_delft` | View of Delft (Vermeer, 1660–61) | https://en.wikipedia.org/wiki/View_of_Delft | https://commons.wikimedia.org/wiki/Special:FilePath/Vermeer-view-of-delft.jpg?width=1600 | `view_of_delft.jpg` |
| 28 | `falling_rocket` | Nocturne in Black and Gold: The Falling Rocket (Whistler, 1875) | https://en.wikipedia.org/wiki/Nocturne_in_Black_and_Gold_%E2%80%93_The_Falling_Rocket | https://commons.wikimedia.org/wiki/Special:FilePath/Whistler-Nocturne%20in%20black%20and%20gold.jpg?width=1600 | `falling_rocket.jpg` |
| 29 | `the_scream` | The Scream (Munch, 1893 — Nasjonalmuseet tempera/oil version) | https://en.wikipedia.org/wiki/The_Scream | https://commons.wikimedia.org/wiki/Special:FilePath/Edvard%20Munch%2C%201893%2C%20The%20Scream%2C%20oil%2C%20tempera%20and%20pastel%20on%20cardboard%2C%2091%20x%2073%20cm%2C%20National%20Gallery%20of%20Norway.jpg?width=1600 | `the_scream.jpg` |
| 30 | `the_park` | The Park (Klimt, 1909–10) | https://en.wikipedia.org/wiki/Gustav_Klimt | https://commons.wikimedia.org/wiki/Special:FilePath/Klimt%20-%20Der%20Park.jpg?width=1600 | `the_park.jpg` |

---

## Notes on canonical versions

A few of these paintings have multiple authentic versions or panels — please use the version specified, since the seed script ties the slug to a single reference image:

- **Sunflowers (#4):** the 1888 National Gallery (London) version, F458 — vase against a yellow ground, 14 sunflowers. Not the Munich, Philadelphia, or Tokyo (Yasuda) versions.
- **Bedroom in Arles (#5):** the first (October 1888) version, now in the Van Gogh Museum, Amsterdam. Not the second (Art Institute of Chicago) or third (Musée d'Orsay).
- **Bridge over a Pond of Water Lilies (#7):** the 1899 Met version (green bridge, lush garden). Monet painted dozens of bridge canvases between 1899 and 1924 — only the 1899 is right here.
- **Mont Sainte-Victoire (#18):** the 1904 Philadelphia Museum of Art version (high-key, fragmented planes). Cézanne painted the mountain ~30 times.
- **Tower of Babel (#25):** the Vienna (Kunsthistorisches) version, 1563. There's also a smaller Rotterdam version — don't substitute.
- **Garden of Earthly Delights (#26):** the **centre panel only**, not the full triptych. If `Special:FilePath` returns the full triptych, crop the centre panel and save under `garden_earthly_delights.jpg`.
- **The Scream (#29):** the 1893 oil/tempera/pastel-on-cardboard version in the Nasjonalmuseet, Oslo. There are four authentic versions; this is the most-reproduced.

## After downloading

Once all 30 files are in `scripts/artwork-refs/`, the seed script (added in a later step) will upload the bytes to Convex storage and insert the catalog rows. You don't need to commit the JPEGs to git — `scripts/artwork-refs/.gitignore` will exclude them.
