# App logo options

The rounds of app-icon ideas from November 2026, kept so they can be reviewed again later.
Open any of these files in a browser (they need an internet connection for the fonts):

- [`round-1.html`](round-1.html): 11 directions (open book, spoon & fork, recipe card, monogram, pie, ...)
- [`round-2.html`](round-2.html): 12 mixes of round 1's A–D, adding the "B" monogram to the others
- [`round-3.html`](round-3.html): 15 variations of round 2's 4–8

**Chosen: round 3, option 5c "Cream Monogram"**: a sage italic "B" in a ring on cream, with a
small crossed spoon and fork. It is drawn in `lib/icons.js`, which makes the site's icon files
at build time. `favicon.ico` is a separate file, made from the same drawing.

This folder is not part of the website (it's in the build's ignore list in `eleventy.config.mjs`).
