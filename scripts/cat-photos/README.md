# cat-photos/

Drop 5 reference cat photos here before running `npm run cat:regression`.

Any common image format works (.jpg, .jpeg, .png, .webp). The script
uses the filename (without extension) as the `petSlug` recorded in the
`catRegressionRenders` table, so name the files descriptively
(e.g. `tabby-front.jpg`, `black-cat-side.jpg`).

This directory is intentionally gitignored at the operator level — these
photos are staging fixtures, not committed assets. Do not commit
customer pet photos here.