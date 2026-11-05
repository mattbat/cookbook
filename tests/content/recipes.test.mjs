// Checks every recipe file, so a typo in a new upload fails the build with a clear
// message instead of quietly breaking the live site.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const matter = require('gray-matter')
const { recipeSlug, recipeImage, tagId } = require('../../lib/recipes.js')

const root = path.resolve(import.meta.dirname, '../..')
const recipeDir = path.join(root, '_recipes')
// Exact names, so "Gumbo.jpeg" vs "gumbo.jpeg" fails here too (the live server is case-sensitive, Windows isn't).
const imageFiles = new Set(fs.readdirSync(path.join(root, 'img')))
const files = fs.readdirSync(recipeDir).filter((name) => name.endsWith('.md')).sort()

// Older files whose names don't follow the lowercase-with-hyphens rule. Renaming them would
// change their web address, so they stay as they are.
const LEGACY_FILENAMES = new Set(['Moroccan Chickpea Soup.md', "myles's_medium_salsa.md"])

// Section names every recipe can use. Sub-groups go under these as "### Crust" etc.
const SECTIONS = ['Ingredients', 'Steps', 'Notes', 'Tools', 'Videos']
// Older recipes with their own section names; renaming them would break links to those headings.
const LEGACY_SECTIONS = {
  'gumbo.md': ['Gumbo Ingredients', 'Roux', 'Chicken'],
  'sausage.md': ['Master Spice Ratio', 'Steps (Day 1)', 'Steps (Day 2)']
}
// Legacy sections that hold ingredients without saying so
const LEGACY_INGREDIENT_SECTIONS = new Set(['gumbo.md#Roux', 'gumbo.md#Chicken'])

// The tags in use. A new tag is fine: add it here, so typos and near-duplicates
// ("cookie" next to "cookies") are caught.
const KNOWN_TAGS = new Set([
  'appetizer', 'soup', 'salad', 'bread', 'side', 'seafood', 'meat', 'poultry', 'main', 'breakfast', 'dessert',
  'bbq', 'smoker', 'grill', 'slow cooker', 'instant pot',
  'beef', 'chicken', 'pork', 'sausage', 'beans', 'rice', 'pasta', 'potatoes', 'vegetable', 'vegetarian', 'fruit',
  'banana', 'pumpkin', 'chocolate', 'cake', 'cookies', 'casserole', 'dip', 'salsa', 'sauce', 'enchiladas',
  'mexican', 'italian', 'greek', 'brazilian', 'arnietex'
])

const FRACTIONS = '½⅓⅔¼¾⅛⅜⅝⅞⅙⅚⅕'
const AMOUNT = `(?:\\d+(?:\\.\\d+)?[${FRACTIONS}]?|[${FRACTIONS}])`
// "1 T", "2t", "1/4 C", "Tbs": ambiguous or non-standard; use tsp, Tbsp, cup(s), oz, lb.
const AMBIGUOUS_UNIT = new RegExp(`${AMOUNT}\\s*(T|t|C|c|Tbs|tbsp|TBSP)\\b`)
const GLUED_UNIT = new RegExp(`\\d(oz|lb|lbs|tsp|Tbsp|cups?)\\b`)
const SPELLED_UNIT = new RegExp(`${AMOUNT}[- ](tablespoons?|teaspoons?|ounces?|pounds?|lbs)\\b`, 'i')
// A range at the start of an ingredient that the serving scaler can't read: "2 or 3", "3-1/2"
const BAD_RANGE = new RegExp(`^${AMOUNT}(\\s+or\\s+${AMOUNT}|-\\d+\\/\\d+)`)

test('there are recipes', () => {
  assert.ok(files.length > 0)
})

test('no two recipes end up at the same web address', () => {
  const seen = new Map()
  for (const file of files) {
    const slug = recipeSlug(file.replace(/\.md$/, '')).toLowerCase()
    assert.ok(!seen.has(slug), `${file} and ${seen.get(slug)} would share /recipes/${slug}/`)
    seen.set(slug, file)
  }
})

for (const file of files) {
  describe(file, () => {
    const raw = fs.readFileSync(path.join(recipeDir, file), 'utf8')
    let parsed
    try {
      parsed = matter(raw)
    } catch (error) {
      test('front matter is valid YAML', () => assert.fail(error.message))
      return
    }
    const { data, content } = parsed
    const lines = content.split(/\r?\n/)
    const ingredientLines = []
    {
      let section = ''
      for (const line of lines) {
        const heading = line.match(/^##[ \t]+(.+?)\s*$/)
        if (heading) section = heading[1]
        else if (/ingredient/i.test(section) || LEGACY_INGREDIENT_SECTIONS.has(`${file}#${section}`)) {
          const item = line.match(/^[-*][ \t]+(.+)$/)
          if (item) ingredientLines.push(item[1])
        }
      }
    }

    test('file name is lowercase-with-hyphens', () => {
      if (LEGACY_FILENAMES.has(file)) return
      assert.match(file, /^[a-z0-9]+(-[a-z0-9]+)*\.md$/, 'rename to something like "my-new-recipe.md"')
    })

    test('starts with one "# Title" heading', () => {
      const titles = content.match(/^#[ \t]+\S.*$/gm) || []
      assert.equal(titles.length, 1, `found ${titles.length} "# " headings; use "## " for sections`)
    })

    test('has a photo that exists in img/', () => {
      const photo = recipeImage(content)
      assert.ok(photo, 'add a line like ![Image of Gumbo](../img/gumbo.jpeg)')
      const name = photo.src.replace(/^\/img\//, '')
      assert.ok(imageFiles.has(name), `img/${name} not found (names must match exactly, including capitals)`)
    })

    test('times are whole minutes', () => {
      for (const field of ['prep_time', 'cooking_time']) {
        const value = data[field]
        if (value === undefined || value === null || value === '') continue
        assert.ok(Number.isInteger(value) && value >= 0, `${field} "${value}" should be minutes as a whole number, like 90 (not "1.5 hr")`)
      }
    })

    test('date is written as YYYY-MM-DD', () => {
      const raw = (parsed.matter.match(/^date:[ \t]*(.*?)\s*$/m) || [])[1]
      assert.match(String(raw), /^\d{4}-\d{2}-\d{2}$/, `date "${raw}" should look like 2024-02-10`)
    })

    test('section headings are the standard ones', () => {
      const allowed = new Set([...SECTIONS, ...(LEGACY_SECTIONS[file] || [])])
      for (const [, name] of content.matchAll(/^##[ \t]+(.+?)\s*$/gm)) {
        assert.ok(allowed.has(name), `"## ${name}" should be one of ${SECTIONS.map((s) => `"## ${s}"`).join(', ')} (put sub-groups under "### ")`)
      }
    })

    test('no empty sections (an empty "## Notes" is fine)', () => {
      const headings = [...content.matchAll(/^(#{2,6})[ \t]+(.+?)\s*$/gm)]
      headings.forEach((match, i) => {
        if (match[2] === 'Notes') return
        const next = headings.slice(i + 1).find((h) => h[1].length <= match[1].length)
        const text = content.slice(match.index + match[0].length, next ? next.index : undefined)
        assert.ok(text.trim(), `"${match[0].trim()}" has nothing under it`)
      })
    })

    test('ingredient units are standard', (t) => {
      for (const line of ingredientLines) {
        assert.ok(!AMBIGUOUS_UNIT.test(line), `"${line}": write units as tsp, Tbsp, cup(s), oz or lb ("T" and "t" are easy to mix up)`)
        assert.ok(!GLUED_UNIT.test(line), `"${line}": put a space between the amount and the unit, like "14 oz"`)
        // Not fatal (imported recipes spell units out): a nudge towards the short forms.
        if (SPELLED_UNIT.test(line)) t.diagnostic(`"${line}": consider tsp, Tbsp, oz or lb`)
        if (/(^|[^\d/])\d\/\d(?![\d/])/.test(line)) t.diagnostic(`"${line}": consider ½-style fractions`)
      }
    })

    test('uses the degree sign ° (not º)', () => {
      const line = lines.find((l) => l.includes('º'))
      assert.ok(!line, `"${line}": replace º with °`)
    })

    test('ingredient ranges are written "2 to 3"', () => {
      for (const line of ingredientLines) {
        assert.ok(!BAD_RANGE.test(line), `"${line}": write ranges like "2 to 3" and mixed numbers like "3½" so serving sizes scale`)
      }
    })

    test('has a valid date', () => {
      const value = data.date instanceof Date ? data.date : new Date(String(data.date).replace(/-(\d)(?!\d)/g, '-0$1'))
      assert.ok(!Number.isNaN(value.getTime()), `date "${data.date}" should look like 2024-02-10`)
    })

    test('has tags', () => {
      assert.ok(Array.isArray(data.tags) && data.tags.length > 0, 'add tags like: tags: [main, soup]')
      for (const tag of data.tags) {
        assert.ok(tagId(tag), `tag "${tag}" has no letters or numbers`)
        assert.ok(KNOWN_TAGS.has(tag), `tag "${tag}" is new or misspelled: use an existing tag, or add it to KNOWN_TAGS in tests/content/recipes.test.mjs (lowercase)`)
      }
    })

    test('servings starts with a number', () => {
      assert.ok(parseFloat(data.servings) > 0, `servings "${data.servings}" should start with a number, like 4 or 6.5 cups`)
    })

    test('has an ingredient list and numbered steps', () => {
      assert.match(content, /^\s*[-*] \S/m, 'ingredients should be a "- " list')
      assert.match(content, /^\s*\d+\. \S/m, 'steps should be a "1. " list')
    })

    test('source link is a web address', (t) => {
      if (data.sourceUrl && !/^https?:\/\//.test(data.sourceUrl)) {
        // Not fatal: shown as plain text. A "source:" field is the place for names.
        t.diagnostic(`sourceUrl "${data.sourceUrl}" is not a link; consider "source: ${data.sourceUrl}"`)
      }
    })
  })
}
