---
name: add-recipe
description: Add a recipe to the Batchelder family cookbook from a photo (of a recipe card, cookbook page or screenshot), a website link, or pasted text. Writes the markdown file in the cookbook's house style, saves the dish photo, runs the recipe checks, and opens a pull request so it publishes. Use whenever the user wants to add, import, save or upload a recipe, e.g. "add this recipe", "save grandma's card", "put this in the cookbook".
---

# Add a recipe to the cookbook

The user is usually on their phone, so keep questions to a minimum: make sensible choices, then
show what you chose and let them correct it. Ask only when something essential is missing or
unreadable (for example, the servings can't be worked out, or a photo is too blurry to read).

The house style is in `README.md` under "How a recipe file is written", and
`tests/content/recipes.test.mjs` enforces it. Follow both; this file summarizes them.

## 1. Get set up

- If `node_modules/` is missing, run `npm ci` (needed for the photo tool and the checks).
- Run `node .claude/skills/add-recipe/scripts/cookbook-context.mjs` for today's date, the allowed
  tags (with how often each is used), the family authors, and the existing recipes.
- If a recipe with the same or a very similar title already exists, tell the user and ask whether
  to update that one or add a new one.

## 2. Read the recipe

**Website link**
1. Run `node .claude/skills/add-recipe/scripts/fetch-recipe.mjs <url>`. Most recipe sites include
   recipe data, so you'll get the name, servings, times (in minutes), ingredients, steps (with
   section names like "For the sauce"), and the photo's address. Sites often list their tips as
   extra steps at the end ("Flour is like a sponge..."): those go in `## Notes`, shortened.
   Ingredients often carry metric weights and brand names ("3 cups (360g) King Arthur Flour"):
   drop the brand and the weights (the site converts to metric itself).
2. If it says the site blocked it (HTTP 403, "Just a moment...") or found only page text, read the
   page with the WebFetch tool instead, asking for the full ingredient list and every step exactly,
   plus the servings, times and main photo address. If that fails too, ask the user to paste the
   recipe text or send a screenshot.

**Photo of a recipe card, cookbook page or screenshot**
- Read it carefully, including handwriting. Keep the cook's own wording and quantities. If a word
  or amount is unreadable, make your best guess, mark it in the summary for the user to check,
  and never invent an ingredient.
- A photo of a card isn't a photo of the dish: don't use it as the recipe's picture (see step 4).

**Pasted text**: use it as is.

## 3. Write `_recipes/<slug>.md`

The slug is the title in lowercase with hyphens, no apostrophes: "Grandma's Pot Roast" ->
`grandmas-pot-roast`. It becomes the web address, so keep it short and plain.

```markdown
---
author: Matt Batchelder
source: King Arthur Baking
sourceUrl: https://www.kingarthurbaking.com/recipes/classic-sandwich-bread-recipe
date: 2026-11-05
prep_time: 15
cooking_time: 40
servings: 16
tags: [bread]
---
# Classic Sandwich Bread

![Image of Classic Sandwich Bread](../img/classic-sandwich-bread.jpeg)

## Ingredients
- 3 cups all-purpose flour
- 1 Tbsp sugar
- 1¼ tsp salt

## Steps
1. Whisk the flour, sugar and salt together.
2. Bake at 350°F for 35 to 40 minutes.

## Notes
- Freezes well for up to 3 months.
```

**Front matter**
- `author`: who makes it in the family. Use the person the user names, or a name written on the
  card; otherwise `Matt Batchelder`. Spell family names as they appear in the context's authors.
- `source` (a name, like "America's Test Kitchen" or "Grandma Sullivan's card") and `sourceUrl`
  (the link, websites only). Leave out what you don't have.
- `subtitle`: optional, one short line. Leave it out unless the user gives one.
- `date`: today, from the context.
- `prep_time`, `cooking_time`: whole minutes. If the source gives only a total, split it sensibly.
  If there are no times, estimate from the steps and say so in the summary.
- `servings`: a number. If the recipe makes a count of something (24 cookies, 2 loaves, 6 cups),
  use the number and add `servingsUnit: Cookies` (or Loaves, Cups...).
- `tags`: 2 to 4 from the allowed list, lowercase: one course (`main`, `side`, `dessert`,
  `breakfast`, `appetizer`, `soup`, `salad`, `bread`...), then the main ingredient or style
  (`chicken`, `beef`, `pasta`, `mexican`, `slow cooker`...). Only add a new tag if nothing fits;
  then also add it to `KNOWN_TAGS` in `tests/content/recipes.test.mjs` and mention it.

**Body**
- One `# Title`, then the photo line, then the sections, in this order: `## Ingredients`,
  `## Steps`, `## Notes` (and `## Tools` for equipment, `## Videos` for video links). Group parts
  with `### Crust`, `### Filling` under a section; never invent other `## ` headings.
- **Ingredients** as `- amount unit item, prep (note)`:
  - Units: `tsp`, `Tbsp`, `cup`/`cups`, `oz`, `lb`, with a space after the number ("14 oz", not
    "14oz"). Spell out other words (cloves, cans, large).
  - Fractions as `½ ¼ ¾ ⅓ ⅔ ⅛`: `1½ cups`, not `1 1/2 cups` or `1.5 cups`.
  - Ranges as `2 to 3`, never `2-3` or `2 or 3`, so the serving buttons scale both.
  - Equipment (pans, mixers, thermometers) goes in `## Tools`, not the ingredients.
  - Keep notes in brackets short: `- 1 lb sausage, sliced (or kielbasa)`.
- **Steps**: a `1. ` list, one step per line, no blank lines between steps. Write each step
  plainly in your own words; don't copy a website's paragraphs, headnotes or stories. Keep every
  time and temperature: `350°F` (with the ° sign), and times like "25 to 30 minutes", so the
  site can turn them into timers and metric.
- **Notes**: a `- ` list of tips, substitutions and storage, only if the source has them.

## 4. Save the photo

Every recipe needs one, at `img/<slug>.jpeg` (the photo line in the file must match exactly).

- A website's photo belongs to whoever took it, and this cookbook is a public site, so don't use
  it by default: use the placeholder (below) and say in the summary that the user can reply "use
  the website's photo" or send their own once they've made it. If they say to use it (now or in
  the request), run `node .claude/skills/add-recipe/scripts/save-photo.mjs "<photo address>" <slug>`.
- A photo of the dish the user sent: first find it as a file. The message may give its path;
  otherwise look for a recently added image, for example
  `find . ~ /tmp -maxdepth 3 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' -o -iname '*.webp' \) -mmin -120 2>/dev/null | grep -v node_modules`,
  then `node .claude/skills/add-recipe/scripts/save-photo.mjs <file> <slug>`.
- No dish photo (a recipe card, pasted text, or a photo you can see but not find as a file):
  `node .claude/skills/add-recipe/scripts/save-photo.mjs --placeholder <slug>`, and tell the user
  they can swap in a real photo later by replacing `img/<slug>.jpeg` (on github.com: open the
  `img` folder, **Add file > Upload files**, same name) or by sending you the photo.

The tool turns the photo upright, removes location details, and caps it at 2000 pixels; the site
build makes the smaller copies for phones.

## 5. Check it

Run `npm run test:unit`. It checks every recipe and says exactly what to fix (for example
`"1 1/2 cups flour": consider ½-style fractions`). Fix the new file until it passes; don't
change other recipes. Treat the "consider" notes for the new file as things to fix too.

## 6. Publish it

1. Work on a branch: if you're on `master`, create `recipe/<slug>`; if this session already has
   its own branch, use that.
2. Commit just the new recipe and photo (and `tests/content/recipes.test.mjs` if you added a tag)
   with a message like `Add Classic Sandwich Bread`, and push.
3. Open a pull request against `master` titled the same, with a short description: where the
   recipe came from and anything the user should check. Use `gh pr create` if it's available;
   otherwise tell the user the branch is pushed and they can create the pull request from the
   app or GitHub.
4. Merging the pull request publishes the recipe: GitHub runs every check, then updates the site
   in about 5 minutes. Only merge it yourself if the user asked you to publish it.

## 7. Tell the user

Keep it short, for a phone screen:
- The recipe title, its future address `https://mattbat.com/cookbook/recipes/<slug>/`, and the
  pull request link.
- What you chose that they may want to change: author, servings, times (say if estimated), tags,
  placeholder photo.
- Anything you couldn't read or had to guess, quoted, so they can check it.
