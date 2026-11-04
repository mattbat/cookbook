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

    test('has a valid date', () => {
      const value = data.date instanceof Date ? data.date : new Date(String(data.date).replace(/-(\d)(?!\d)/g, '-0$1'))
      assert.ok(!Number.isNaN(value.getTime()), `date "${data.date}" should look like 2024-02-10`)
    })

    test('has tags', () => {
      assert.ok(Array.isArray(data.tags) && data.tags.length > 0, 'add tags like: tags: [main, soup]')
      for (const tag of data.tags) {
        assert.ok(tagId(tag), `tag "${tag}" has no letters or numbers`)
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
