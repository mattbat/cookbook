import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { recipeSteps, isoDuration, recipeJsonLd } = require('../../lib/recipes.js')

const BODY = `# Gumbo

## Ingredients
- 2 cups cooked chicken (See "Chicken")
- 1 lb sausage

## Steps
1. Brown the sausage.  Stir often.

2. Add the **roux**
and the stock.
3. Simmer 10 minutes.
   - taste for salt

## Notes
1. Roux freezes well
`

test('steps are the numbered items under Steps, not Notes', () => {
  assert.deepEqual(recipeSteps(BODY), [
    'Brown the sausage. Stir often.',
    'Add the roux and the stock.',
    'Simmer 10 minutes.'
  ])
})

test('steps from several Steps sections are joined in order', () => {
  const body = '## Steps (Day 1)\n1. Soak\n\n## Steps (Day 2)\n1. Cook\n2. Serve\n'
  assert.deepEqual(recipeSteps(body), ['Soak', 'Cook', 'Serve'])
})

test('smaller headings inside Steps are still steps; the next section ends them', () => {
  const body = '## Steps\n### Cake\n1. Bake\n### Topping\n1. Whip\n## Notes\n1. Keeps a week\n'
  assert.deepEqual(recipeSteps(body), ['Bake', 'Whip'])
})

test('minutes become ISO 8601 durations', () => {
  assert.equal(isoDuration(90), 'PT1H30M')
  assert.equal(isoDuration(45), 'PT45M')
  assert.equal(isoDuration(120), 'PT2H')
  assert.equal(isoDuration(0), undefined)
  assert.equal(isoDuration(''), undefined)
})

test('recipe data has what Google needs, and leaves out what is missing', () => {
  const data = recipeJsonLd({
    body: BODY,
    title: 'Gumbo',
    author: 'Tracy Batchelder',
    date: new Date('2024-02-10'),
    servings: 8,
    prep_time: 90,
    cooking_time: 30,
    tags: ['soup', 'main'],
    summary: 'A gumbo.',
    url: 'https://mattbat.com/cookbook/recipes/gumbo/',
    image: 'https://mattbat.com/cookbook/img/gumbo.jpeg'
  })
  assert.equal(data['@type'], 'Recipe')
  assert.equal(data.name, 'Gumbo')
  assert.deepEqual(data.image, ['https://mattbat.com/cookbook/img/gumbo.jpeg'])
  assert.deepEqual(data.author, { '@type': 'Person', name: 'Tracy Batchelder' })
  assert.equal(data.datePublished, '2024-02-10')
  assert.equal(data.prepTime, 'PT1H30M')
  assert.equal(data.cookTime, 'PT30M')
  assert.equal(data.totalTime, 'PT2H')
  assert.equal(data.recipeYield, '8')
  assert.equal(data.keywords, 'soup, main')
  assert.deepEqual(data.recipeIngredient, ['2 cups cooked chicken', '1 lb sausage'])
  assert.equal(data.recipeInstructions.length, 3)
  assert.deepEqual(data.recipeInstructions[0], { '@type': 'HowToStep', text: 'Brown the sausage. Stir often.' })

  const bare = recipeJsonLd({ body: '# Toast\n', title: 'Toast', url: 'https://example.com/' })
  assert.deepEqual(Object.keys(bare).sort(), ['@context', '@type', 'name', 'url'])
})
