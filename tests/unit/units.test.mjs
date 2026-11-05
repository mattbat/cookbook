import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { toMetric, textToMetric, fahrenheitToCelsius, inchesToMetric, unitNumber } = require('../../js/units.js')
const { getIngredients, ingredientToHTML } = require('../../js/recipe-scaling.js')

const metric = (amount, unit) => {
  const result = toMetric(amount, unit)
  return result && `${result.value} ${result.unit}`
}
const item = (html) => getIngredients([{ childNodes: [], innerHTML: html }])[0]
const rendered = (html, scale = 1, system = 'metric') =>
  ingredientToHTML(item(html), scale, system).replace(/<[^>]+>/g, '')

test('volumes become mL, or L from a liter up', () => {
  assert.equal(metric(1, 'cup'), '240 mL')
  assert.equal(metric(2, 'cups'), '470 mL')
  assert.equal(metric(0.25, 'cup'), '60 mL')
  assert.equal(metric(7, 'cups'), '1.65 L')
  assert.equal(metric(1, 'quart'), '950 mL')
  assert.equal(metric(1, 'gallon'), '3.8 L')
  assert.equal(metric(4, 'fl oz'), '120 mL')
})

test('weights become g, or kg from a kilo up', () => {
  assert.equal(metric(1, 'lb'), '450 g')
  assert.equal(metric(2.5, 'lbs'), '1.15 kg')
  assert.equal(metric(8, 'oz'), '230 g')
  assert.equal(metric(0.5, 'oz'), '14 g')
  assert.equal(metric(1, 'stick'), '110 g')
})

test('teaspoons, tablespoons and things like "cloves" are left as they are', () => {
  for (const unit of ['tsp', 'Tbsp', 'tablespoons', 'cloves', 'large', 'can']) assert.equal(metric(2, unit), null)
})

test('oven temperatures round to 5°C; meat temperatures to the degree', () => {
  assert.equal(fahrenheitToCelsius(350), 175)
  assert.equal(fahrenheitToCelsius(325), 165)
  assert.equal(fahrenheitToCelsius(225), 105)
  assert.equal(fahrenheitToCelsius(165), 74)
  assert.equal(fahrenheitToCelsius(145), 63)
})

test('inches become cm, or mm when small', () => {
  assert.equal(inchesToMetric(9), '23 cm')
  assert.equal(inchesToMetric(1), '2.5 cm')
  assert.equal(inchesToMetric(0.25), '6 mm')
})

test('reads the numbers recipes use', () => {
  assert.equal(unitNumber('3-3/4'), 3.75)
  assert.equal(unitNumber('1 1/2'), 1.5)
  assert.equal(unitNumber('3½'), 3.5)
  assert.equal(unitNumber('⅔'), 2 / 3)
})

test('converts temperatures, sizes and amounts in a step', () => {
  assert.equal(textToMetric('Bake at 350°F in a 9-inch pan.'), 'Bake at 175°C in a 23 cm pan.')
  assert.equal(textToMetric('heat to 325-350°F'), 'heat to 165-175°C')
  assert.equal(textToMetric('cook until it registers 165°F'), 'cook until it registers 74°C')
  assert.equal(textToMetric('smoke at 225 degrees'), 'smoke at 105°C')
  assert.equal(textToMetric('cut into 1-inch pieces'), 'cut into 2.5 cm pieces')
  assert.equal(textToMetric('Beat in ¾ cup of the sugar'), 'Beat in 180 mL of the sugar')
  assert.equal(textToMetric('add 2 to 3 lb of beef'), 'add 0.9 to 1.35 kg of beef')
})

test('leaves alone what isn\'t a US measure', () => {
  for (const text of ['1 tsp salt', 'Simmer 30 minutes', 'Use a 4-cup measuring cup', 'Cut into 8 pieces', 'cupcakes']) {
    assert.equal(textToMetric(text), text)
  }
})

test('ingredients: the amount and unit at the start, and amounts later in the line', () => {
  assert.equal(rendered('2 cups cooked chicken'), '470 mL cooked chicken')
  assert.equal(rendered('1 lb sausage, cut into slices'), '450 g sausage, cut into slices')
  assert.equal(rendered('½ cup (3½ ounces) sugar'), '120 mL (100 g) sugar')
  assert.equal(rendered('1 (15 oz) can black beans'), '1 (430 g) can black beans')
  assert.equal(rendered('2 tsp salt'), '2 tsp salt')
  assert.equal(rendered('Pinch table salt'), 'Pinch table salt')
})

test('ingredients: metric follows the servings, and both ends of a range', () => {
  assert.equal(rendered('2 cups cooked chicken', 2), '950 mL cooked chicken')
  assert.equal(rendered('2 to 3 lb chuck roast', 2), '1.8 to 2.7 kg chuck roast')
  assert.equal(rendered('2 to 3 lb chuck roast', 1, 'us'), '2 to 3 lb chuck roast')
})
