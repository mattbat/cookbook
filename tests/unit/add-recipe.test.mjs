// The helper scripts the add-recipe skill (.claude/skills/add-recipe) uses.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const scripts = '../../.claude/skills/add-recipe/scripts/'
const { isoMinutes, recipeFromHtml, pageFromHtml } = await import(scripts + 'fetch-recipe.mjs')
const { preparePhoto, placeholderPhoto, validSlug } = await import(scripts + 'save-photo.mjs')
const { knownTags, today, cookbookContext } = await import(scripts + 'cookbook-context.mjs')
const require = createRequire(import.meta.url)
const sharp = require('sharp')
const root = path.resolve(import.meta.dirname, '../..')

const page = (data) => `<html><head><title>Test</title>
  <script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`

test('reads recipe times written as ISO durations', () => {
  assert.equal(isoMinutes('PT1H30M'), 90)
  assert.equal(isoMinutes('PT45M'), 45)
  assert.equal(isoMinutes('P0DT2H'), 120)
  assert.equal(isoMinutes('PT0M'), null)
  assert.equal(isoMinutes('20 minutes'), null)
  assert.equal(isoMinutes(undefined), null)
})

test('finds the Recipe in a page\'s schema.org data, even inside @graph', () => {
  const html = page({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: 'Not this' },
      {
        '@type': ['Recipe', 'NewsArticle'],
        name: 'Mac &amp; Cheese',
        author: [{ '@type': 'Person', name: 'Pat Cook' }],
        recipeYield: ['4', '4 servings'],
        prepTime: 'PT10M',
        cookTime: 'PT25M',
        recipeIngredient: ['8 oz elbow macaroni', '2 cups <b>shredded</b> cheddar'],
        recipeInstructions: [
          { '@type': 'HowToSection', name: 'Pasta', itemListElement: [{ '@type': 'HowToStep', text: 'Boil the pasta 8 minutes.' }] },
          { '@type': 'HowToStep', text: 'Stir in the cheese.' }
        ],
        keywords: 'easy, cheesy',
        image: [{ '@type': 'ImageObject', url: 'https://example.com/mac.jpg' }]
      }
    ]
  })
  const recipe = recipeFromHtml(html, 'https://example.com/mac')
  assert.equal(recipe.name, 'Mac & Cheese')
  assert.equal(recipe.author, 'Pat Cook')
  assert.equal(recipe.servings, '4')
  assert.equal(recipe.prepMinutes, 10)
  assert.equal(recipe.cookMinutes, 25)
  assert.deepEqual(recipe.ingredients, ['8 oz elbow macaroni', '2 cups shredded cheddar'])
  assert.deepEqual(recipe.steps, [
    { section: 'Pasta', text: 'Boil the pasta 8 minutes.' },
    { section: null, text: 'Stir in the cheese.' }
  ])
  assert.deepEqual(recipe.keywords, ['easy', 'cheesy'])
  assert.equal(recipe.image, 'https://example.com/mac.jpg')
})

test('steps given as one block of text are split into lines', () => {
  const recipe = recipeFromHtml(page({ '@type': 'Recipe', name: 'Toast', recipeInstructions: 'Toast the bread.\nButter it.' }))
  assert.deepEqual(recipe.steps.map((step) => step.text), ['Toast the bread.', 'Butter it.'])
})

test('a page without recipe data gives its title, photo and text instead', () => {
  assert.equal(recipeFromHtml('<html><body>No data</body></html>'), null)
  assert.equal(recipeFromHtml('<script type="application/ld+json">{not json</script>'), null)
  const result = pageFromHtml(`<html><head><title>Grandma's Pie</title>
    <meta property="og:image" content="https://example.com/pie.jpg"></head>
    <body><nav>Menu</nav><h1>Pie</h1><ul><li>1 cup flour</li><li>2 eggs</li></ul><script>var x</script></body></html>`)
  assert.equal(result.title, "Grandma's Pie")
  assert.equal(result.image, 'https://example.com/pie.jpg')
  assert.equal(result.text, 'Pie\n1 cup flour\n2 eggs')
})

test('photo names must be lowercase-with-hyphens, like recipe files', () => {
  assert.ok(validSlug('grandmas-pot-roast'))
  for (const bad of ['', 'Pot Roast', 'pot_roast', '-roast', "grandma's"]) assert.ok(!validSlug(bad), bad)
})

test('photos are turned upright, shrunk to 2000 pixels and saved as JPEG', async () => {
  // A 3000x1000 photo stored sideways, the way phones often save them
  const sideways = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#c08040' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer()
  const out = await sharp(await preparePhoto(sideways)).metadata()
  assert.equal(out.format, 'jpeg')
  assert.deepEqual([out.width, out.height], [667, 2000])
  assert.ok(!out.orientation || out.orientation === 1, 'still marked as sideways')

  const small = await sharp({ create: { width: 800, height: 600, channels: 4, background: '#00000000' } }).png().toBuffer()
  const kept = await sharp(await preparePhoto(small)).metadata()
  assert.deepEqual([kept.width, kept.height, kept.format], [800, 600, 'jpeg'], 'small photos keep their size')

  await assert.rejects(preparePhoto(Buffer.from('not a photo')), /isn't a photo/)
})

test('the placeholder photo is a 4:3 cookbook-colored image', async () => {
  const meta = await sharp(await placeholderPhoto()).metadata()
  assert.deepEqual([meta.width, meta.height, meta.format], [1200, 900, 'jpeg'])
})

test('the cookbook context lists the allowed tags, authors and recipes', () => {
  const source = fs.readFileSync(path.join(root, 'tests/content/recipes.test.mjs'), 'utf8')
  const tags = knownTags(source)
  assert.ok(tags.includes('main') && tags.includes('slow cooker'))
  assert.match(today(new Date(2026, 0, 5)), /^2026-01-05$/)

  const context = cookbookContext(root)
  assert.deepEqual(context.tags.map((t) => t.tag).sort(), [...tags].sort())
  assert.ok(context.authors.some((author) => author.name === 'Matt Batchelder'))
  assert.ok(context.recipes.some((recipe) => recipe.file === '_recipes/gumbo.md' && recipe.title === 'Gumbo'))
})

test('the skill tells Claude about every script it can use', () => {
  const skill = fs.readFileSync(path.join(root, '.claude/skills/add-recipe/SKILL.md'), 'utf8')
  assert.match(skill, /^---\nname: add-recipe\ndescription: .+\n---\n/)
  for (const script of fs.readdirSync(path.join(root, '.claude/skills/add-recipe/scripts'))) {
    assert.ok(skill.includes(script), `SKILL.md doesn't mention ${script}`)
  }
})
