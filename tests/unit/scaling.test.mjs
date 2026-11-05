import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse_number, render_number, nextServings, getIngredients, ingredientToHTML } = require('../../js/recipe-scaling.js')

test('parses whole numbers, decimals and fractions', () => {
  assert.equal(parse_number('2'), 2)
  assert.equal(parse_number('2.5'), 2.5)
  assert.equal(parse_number('1/2'), 0.5)
  assert.equal(parse_number('2/3'), 2 / 3)
})

test('parses unicode fractions like ½ and 1½', () => {
  assert.equal(parse_number('½'), 0.5)
  assert.equal(parse_number('¼'), 0.25)
  assert.equal(parse_number('1½'), 1.5)
})

test('renders amounts under 5 as unicode fractions', () => {
  assert.equal(render_number(0.5), '½')
  assert.equal(render_number(1.5), '1½')
  assert.equal(render_number(0.75), '¾')
  assert.equal(render_number(1 / 3), '⅓')
  assert.equal(render_number(3), '3')
})

test('amounts that match no fraction stay decimals, whole numbers stay whole', () => {
  assert.equal(render_number(10.45), '10.45')
  assert.equal(render_number(2.45), '2.45')
  assert.equal(render_number(12), '12')
})

test('doubling and halving common amounts', () => {
  assert.equal(render_number(parse_number('1/2') * 2), '1')
  assert.equal(render_number(parse_number('2/3') * 1.5), '1')
  assert.equal(render_number(parse_number('1/4') * 0.5), '⅛')
})

test('servings buttons step by 1 from 2 upward', () => {
  assert.equal(nextServings(8, 'up'), 9)
  assert.equal(nextServings(8, 'down'), 7)
  assert.equal(nextServings(2, 'down'), 1)
})

test('servings buttons use friendly steps below 2', () => {
  assert.equal(nextServings(1, 'up'), 2)
  assert.equal(nextServings(1, 'down'), 0.8)
  assert.equal(nextServings(0.5, 'down'), 0.33)
  assert.equal(nextServings(0.1, 'down'), 0.1)
})

test('scaled ingredient keeps its name and shows the new amount', () => {
  const html = ingredientToHTML({ amount: 2, name: ' cups cooked chicken' }, 1.5)
  assert.match(html, /<span class="scaled"[^>]*>3<\/span> cups cooked chicken/)
})

test('ingredients without an amount are left alone', () => {
  assert.equal(ingredientToHTML({ amount: undefined, name: 'Pinch table salt' }, 2), 'Pinch table salt')
})

test('renders large amounts with fractions too', () => {
  assert.equal(render_number(10.5), '10½')
  assert.equal(render_number(7 * 1.5), '10½')
  assert.equal(render_number(12.25), '12¼')
})

test('parses mixed numbers like 1 1/2', () => {
  assert.equal(parse_number('1 1/2'), 1.5)
  assert.equal(parse_number('2 ½'), 2.5)
})

// getIngredients only needs innerHTML and childNodes, so simple fakes will do
const item = (innerHTML) => ({ innerHTML, childNodes: [] })
const parse = (innerHTML) => {
  const [ingredient] = getIngredients([item(innerHTML)])
  return { amount: ingredient.amount, prefix: ingredient.prefix, name: ingredient.name }
}

test('a leading whole number is the amount', () => {
  assert.deepEqual(parse('2 cups cooked chicken'), { amount: 2, prefix: '', name: ' cups cooked chicken' })
})

test('only the leading number is the amount, later numbers stay', () => {
  const html = '7 cups chicken stock (if cooking whole chicken, will only need 2-3 cups extra stock)'
  assert.deepEqual(parse(html), { amount: 7, prefix: '', name: html.slice(1) })
})

test('a leading fraction is the amount', () => {
  assert.deepEqual(parse('1/2 teaspoon pepper'), { amount: 0.5, prefix: '', name: ' teaspoon pepper' })
})

test('a leading unicode fraction is the amount', () => {
  assert.deepEqual(parse('½ cup (3½ ounces) sugar'), { amount: 0.5, prefix: '', name: ' cup (3½ ounces) sugar' })
  assert.deepEqual(parse('1½ cups sugar'), { amount: 1.5, prefix: '', name: ' cups sugar' })
})

test('a leading decimal is the amount', () => {
  assert.deepEqual(parse('2.5 pounds cream cheese'), { amount: 2.5, prefix: '', name: ' pounds cream cheese' })
})

test('a leading mixed number is the amount', () => {
  assert.deepEqual(parse('1 1/2 cups flour'), { amount: 1.5, prefix: '', name: ' cups flour' })
})

test('an amount inside a <p> (loose list) is found and the <p> kept', () => {
  const ingredient = parse('\n<p>2 cups flour</p>\n')
  assert.deepEqual(ingredient, { amount: 2, prefix: '\n<p>', name: ' cups flour</p>\n' })
  assert.match(ingredientToHTML(ingredient, 2), /^\n<p><span class="scaled"[^>]*>4<\/span> cups flour<\/p>\n$/)
})

test('an item with a link and no leading amount is left alone', () => {
  const html = 'Trim: <a href="https://www.youtube.com/watch?v=MTc5VAgZKLE&amp;t=1s">video</a>'
  assert.deepEqual(parse(html), { amount: undefined, prefix: '', name: html })
  assert.equal(ingredientToHTML(parse(html), 2), html)
})

test('a link whose attributes hold digits is never treated as an amount', () => {
  assert.equal(parse('<a href="x5">x</a>').amount, undefined)
})

test('an item without an amount is left alone', () => {
  assert.deepEqual(parse('Pinch table salt'), { amount: undefined, prefix: '', name: 'Pinch table salt' })
  assert.equal(parse('Coarse Black Pepper').amount, undefined)
})

test('items holding a nested list are skipped', () => {
  assert.deepEqual(getIngredients([{ innerHTML: 'Sauce<ul><li>1 cup</li></ul>', childNodes: [{ nodeName: 'UL' }] }]), [])
})

test('ranges like "2 to 3" and "8-10" scale both ends', () => {
  const [a] = getIngredients([item('8 to 10 lb pork shoulder')])
  assert.equal(a.amount, 8)
  assert.equal(a.amountTo, 10)
  assert.match(ingredientToHTML(a, 2), /<span class="scaled"[^>]*>16 to 20<\/span> lb pork shoulder/)
  const [b] = getIngredients([item('2 to 2½ tsp salt')])
  assert.match(ingredientToHTML(b, 2), />4 to 5<\/span> tsp salt/)
  const [c] = getIngredients([item('4-5 green onions')])
  assert.match(ingredientToHTML(c, 2), />8-10<\/span> green onions/)
})

test('a hyphen that is not a range is left alone', () => {
  const [a] = getIngredients([item('½-inch slices of leek')])
  assert.equal(a.amountTo, undefined)
  assert.match(ingredientToHTML(a, 2), />1<\/span>-inch slices of leek/)
})
