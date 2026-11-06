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
  assert.equal(textToMetric('Beat in ¾ cup of the sugar'), 'Beat in 150 g of the sugar')
  assert.equal(textToMetric('Stir in ½ cup flour, then 1 cup milk'), 'Stir in 60 g flour, then 240 mL milk')
  assert.equal(textToMetric('add 2 to 3 lb of beef'), 'add 0.9 to 1.35 kg of beef')
})

test('leaves alone what isn\'t a US measure', () => {
  for (const text of ['1 tsp salt', 'Simmer 30 minutes', 'Use a 4-cup measuring cup', 'Cut into 8 pieces', 'cupcakes']) {
    assert.equal(textToMetric(text), text)
  }
})

test('ingredients: the amount and unit at the start, and amounts later in the line', () => {
  assert.equal(rendered('2 cups cooked chicken'), '280 g cooked chicken')
  assert.equal(rendered('1 lb sausage, cut into slices'), '450 g sausage, cut into slices')
  assert.equal(rendered('½ cup (3½ ounces) sugar'), '100 g sugar')
  assert.equal(rendered('1 (15 oz) can black beans'), '1 (430 g) can black beans')
  assert.equal(rendered('2 tsp salt'), '2 tsp salt')
  assert.equal(rendered('Pinch table salt'), 'Pinch table salt')
})

test('ingredients: metric follows the servings, and both ends of a range', () => {
  assert.equal(rendered('2 cups cooked chicken', 2), '560 g cooked chicken')
  assert.equal(rendered('2 cups milk', 2), '950 mL milk')
  assert.equal(rendered('1 cup (5¼ oz) sugar', 2), '300 g sugar')
  assert.equal(rendered('2 to 3 lb chuck roast', 2), '1.8 to 2.7 kg chuck roast')
  assert.equal(rendered('2 to 3 lb chuck roast', 1, 'us'), '2 to 3 lb chuck roast')
})

test('dry and solid ingredients measured in cups are weighed, like a metric recipe', () => {
  assert.equal(rendered('2 cups flour'), '240 g flour')
  assert.equal(rendered('1¾ cups all-purpose flour'), '210 g all-purpose flour')
  assert.equal(rendered('½ cup (2¾ oz) whole wheat flour'), '80 g whole wheat flour')
  assert.equal(rendered('2 cups sugar'), '400 g sugar')
  assert.equal(rendered('1 cup light brown sugar'), '220 g light brown sugar')
  assert.equal(rendered('½ cup butter'), '110 g butter')
  assert.equal(rendered('1 cup (2 sticks) butter, melted'), '230 g butter, melted')
  assert.equal(rendered('2 cups shredded cheddar cheese'), '230 g shredded cheddar cheese')
  assert.equal(rendered('1 cup quick oats (see note)'), '80 g quick oats (see note)')
  assert.equal(rendered('2 cups long grain rice'), '380 g long grain rice')
  assert.equal(rendered('½ cup chocolate chips or other add-ins'), '85 g chocolate chips or other add-ins')
  assert.equal(rendered('2 cups onion, chopped'), '320 g onion, chopped')
  assert.equal(rendered('2 cups sour cream'), '460 g sour cream')
})

test('liquids stay in mL, even when they mention a solid', () => {
  assert.equal(rendered('2 cups buttermilk'), '470 mL buttermilk')
  assert.equal(rendered('4 cups low-sodium chicken broth'), '950 mL low-sodium chicken broth')
  assert.equal(rendered('1 cup heavy cream'), '240 mL heavy cream')
  assert.equal(rendered('⅔ cup oil'), '160 mL oil')
  assert.equal(rendered('2½ cups tomato sauce'), '590 mL tomato sauce')
  assert.equal(rendered('⅓ cup chicken base'), '80 mL chicken base')
})

test('ounces of a liquid are fluid ounces, but cans and jars keep their weight', () => {
  assert.equal(textToMetric('swap out 6 oz of the beef broth'), 'swap out 180 mL of the beef broth')
  assert.equal(rendered('1 (8 oz) jar salsa'), '1 (230 g) jar salsa')
  assert.equal(rendered('1 (10 oz) can evaporated milk'), '1 (280 g) can evaporated milk')
})

test('sizes are left alone, and a bracket after a weight stays consistent with it', () => {
  assert.equal(rendered('About 22 pint sized canning jars'), 'About 22 pint sized canning jars')
  assert.equal(rendered('4½ quart slow cooker'), '4.25 L slow cooker')
  assert.equal(rendered('1 gallon cucumbers, cauliflower, peppers'), '3.8 L cucumbers, cauliflower, peppers')
  assert.equal(rendered('1½ lb firm ripe tomatoes, diced (about 3 cups)'), '680 g firm ripe tomatoes, diced (about 710 mL)')
})
