import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse_number, render_number, nextServings, ingredientToHTML } = require('../../js/recipe-scaling.js')

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

test('renders larger amounts as decimals', () => {
  assert.equal(render_number(10.5), '10.5')
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

// Known issue: "10.5 cups" should read "10½ cups". Remove `todo` when fixed.
test('renders large amounts with fractions too', { todo: 'Phase 1' }, () => {
  assert.equal(render_number(10.5), '10½')
})
