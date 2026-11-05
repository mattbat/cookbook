# 📖 Cookbook

The Batchelder family cookbook: [mattbat.com/cookbook](https://mattbat.com/cookbook/).

Every recipe is a markdown file in `_recipes/`. Add or change one on `master` and the site
rebuilds, tests itself, and publishes on its own.

## Adding a recipe

1. Copy `_recipes/_template/template.md` to `_recipes/my-new-recipe.md`
   (lowercase, with hyphens: the file name becomes the web address).
2. Put the photo in `img/` and point to it: `![Image of My New Recipe](../img/my-new-recipe.jpeg)`.
3. Fill in the details at the top (`author`, `servings`, `tags`, ...) and the recipe itself:
   one `# Title`, then `## Ingredients` as a `- ` list and `## Steps` as a `1. ` list.
4. Commit to `master`, either from your computer or with **Add file** on github.com.

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
`js/`:

| File | Where | What |
|---|---|---|
| `app.js` | every page | tap a step to keep your place; shared helpers |
| `timers.js` | every page | times in the steps ("simmer 30-40 minutes") become timer buttons; running timers follow you between pages |
| `search.js` | Search tab | search and category filters |
| `recipe-scaling.js` | recipes | the servings stepper |
| `kitchen.js` | recipes | ingredient check-offs, Copy list, Share, Keep screen on, Cook mode |
| `offline.js` | offline page | lists the recipes saved on this device |

Every recipe page also carries [schema.org Recipe](https://schema.org/Recipe) data (built by
`recipeJsonLd` in `lib/recipes.js`), so Google and recipe apps can read the ingredients, steps
and times. Steps are the numbered lists under a `## Steps` heading (`### ` sub-headings inside it
are fine); Notes lists aren't steps.

Keep screen on, the share sheet and the clipboard need a secure (https) page, so when you test on
your phone at `http://<your IP>:8080` the Keep screen on button is hidden and Share copies the link
instead. On the live site they all work.

### App and offline

- **Add to Home Screen** makes the cookbook open full screen with its own icon (`manifest.webmanifest.njk`;
  the icon is drawn in `lib/icons.js` and saved as PNGs during the build). The home page shows a
  card explaining how, until it's installed or dismissed.
- **Offline**: `sw.js.njk` is a service worker that saves the site on the phone. Pages are always
  fetched fresh when there's signal (after 4 seconds on a weak signal, the saved copy is used);
  recipes you've opened before work with no signal at all, and other pages show `/offline/`, which
  lists the saved recipes. It needs https, so it doesn't run when testing on a phone over `http://`.
- **Photos**: `lib/photos.js` makes smaller copies of every photo in `img/` (240 to 1600 pixels
  wide, in `img/w/`), and pages use `srcset` so phones download one about the size of their
  screen. Copies are kept in `.cache/photos` so only new or changed photos are resized; the first
  build after cloning takes about 30 seconds longer. Keep adding full-size photos to `img/` as before.

If `npm start` is running, stop it before `npm test`: both write to `_site/`. Restart `npm start`
after changing `eleventy.config.mjs`, `lib/` or `_data/`, which it doesn't reload on its own.

The site's sections (the bottom tabs on phones, the top links on desktop) and the category list
are set in `_data/site.json`. A category only appears once at least one recipe has its tag.

Originally based on
[jansim/cookbook](https://github.com/jansim/cookbook) and the
[beautiful-jekyll](https://github.com/daattali/beautiful-jekyll) theme by Dean Attali.
