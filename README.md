# 📖 Cookbook

The Batchelder family cookbook: [mattbat.com/cookbook](https://mattbat.com/cookbook/).

Every recipe is a markdown file in `_recipes/`. Add or change one on `master` and the site
rebuilds, tests itself, and publishes on its own.

## Adding a recipe

1. Copy `_recipes/_template/template.md` to `_recipes/my-new-recipe.md`
   (lowercase, with hyphens: the file name becomes the web address).
2. Put the photo in `img/` and point to it: `![Image of My New Recipe](../img/my-new-recipe.jpeg)`.
3. Fill in the details at the top (`author`, `servings`, `tags`, ...) and the recipe itself:
   one `# Title`, then `## Ingredients` as a `- ` list and `## Steps` as a `1. ` list (see below).
4. Commit to `master`, either from your computer or with **Add file** on github.com.

### How a recipe file is written

Recipes are plain markdown so they stay usable whatever the website becomes. Keep them consistent:

- **Top block (front matter)**
  - `date`: the day it was added, `YYYY-MM-DD`
  - `prep_time`, `cooking_time`: whole minutes (`90`, not `1.5 hr`)
  - `servings`: a number; add `servingsUnit: Cups` (or Pints, Cookies…) when it isn't people
  - `author`: who makes it in the family; `source`: where it came from, as a name; `sourceUrl`: a link to the original
  - `tags`: lowercase, from the list in `tests/content/recipes.test.mjs` (add new ones there)
  - `featured: true` puts a recipe on the home page's Featured shelf
- **Sections**: `## Ingredients`, `## Steps`, `## Notes`, and when needed `## Tools` (equipment) and
  `## Videos` (`- Cook: <https://…>`). Sub-groups go under `### Crust`, `### Filling`…
- **Ingredients**: `- amount unit item, prep (note)`, e.g. `- 1½ cups red onion, finely chopped`
  - Units: `tsp`, `Tbsp`, `cup`/`cups`, `oz`, `lb`, with a space after the number
  - Fractions as `½ ¼ ¾ ⅓ ⅔ ⅛` (`1½`, not `1 1/2`)
  - Ranges as `2 to 3`, so the serving-size buttons scale both numbers
  - Equipment goes in `## Tools`, not the ingredient list (it would be scaled)
- **Steps**: a `1. ` list with one line per step and no blank lines between steps
- **Notes**: a `- ` list
- Temperatures as `350°F` (the degree sign °, not º)

`npm run test:unit` checks most of this and says exactly what to fix.

Or let the tools write the file for you:

```bash
npm run new "Grandma's Pot Roast"
```

```bash
npm run import https://example.com/some-recipe
```

(`import` needs a [Spoonacular](https://spoonacular.com) API key: copy
`CLI/CREDENTIALS.example.json` to `CLI/CREDENTIALS.json` and add your key.)

## Working on the site locally

You need [Node.js](https://nodejs.org) 22 or newer. Once, after cloning:

```bash
npm install
```

```bash
npx playwright install chromium webkit
```

Then:

| Command | What it does |
|---|---|
| `npm start` | Builds the site and serves it at http://localhost:8080/cookbook/, rebuilding as you save |
| `npm test` | Everything below, in order (what GitHub runs before publishing) |
| `npm run test:unit` | Checks every recipe file, and the serving-size math (a couple of seconds) |
| `npm run build` | Builds the site into `_site/` |
| `npm run test:build` | Checks the built site: every old address still works, no broken links or photos |
| `npm run test:e2e` | Clicks through the site on an iPhone, an Android phone and a desktop browser |
| `npm run test:e2e:ui` | Same, in a window where you can watch each test and step through it |

If `npm start` is already running, the browser tests use it instead of starting their own server.
After a failed browser test, `npx playwright show-report` shows screenshots and a step-by-step trace.

On Windows PowerShell, type `npm.cmd` instead of `npm` if PowerShell says running scripts is disabled.

To try the site on your phone, run `npm start`, connect the phone to the same Wi-Fi, and open
`http://<your computer's IP address>:8080/cookbook/` (`ipconfig` shows the address).

### Known issues are tests too

Bugs we know about have tests marked `test.fail` (browser tests) or `todo` (unit tests). They
pass today *because* the bug is still there. When a fix lands, that test starts complaining
("expected to fail, but passed"); remove the marker so it guards the fix from then on.

## How publishing works

`.github/workflows/site.yml` runs on every push to `master`, on pull requests, and on demand
from the **Actions** tab:

1. Checks every recipe file and the scaling math
2. Builds the site with [Eleventy](https://www.11ty.dev)
3. Checks the built site (addresses, links, photos)
4. Runs the browser tests
5. Publishes to GitHub Pages, but only from `master` and only if everything above passed

If anything fails, the live site stays as it was, GitHub emails you, and the run's page shows
the exact problem (for example `gumbo.md: img/gumbo.jpg not found`).

### Turning on publishing (one-time cutover)

Until this is done, GitHub's old built-in Jekyll build is still what publishes the site.

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
   The current site stays up until the next publish.
2. **Settings → Secrets and variables → Actions → Variables:** add `PAGES_DEPLOY` = `actions`.
3. Merge to `master` (or run the workflow from the **Actions** tab).

## Tech

Built with [Eleventy](https://www.11ty.dev), searched with [MiniSearch](https://lucaong.github.io/minisearch/),
tested with [Playwright](https://playwright.dev) and Node's built-in test runner, and hosted on
GitHub Pages. No CSS or JavaScript framework: the look is in `css/site.css`, page behaviour in
`js/` (`app.js` everywhere, `search.js` on the Search tab, `recipe-scaling.js` on recipes).

The site's sections (the bottom tabs on phones, the top links on desktop) and the category list
are set in `_data/site.json`. A category only appears once at least one recipe has its tag.

Originally based on
[jansim/cookbook](https://github.com/jansim/cookbook) and the
[beautiful-jekyll](https://github.com/daattali/beautiful-jekyll) theme by Dean Attali.
