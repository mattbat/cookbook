// US / metric switch on recipe pages. Cups, quarts and gallons become mL or L; ounces, pounds and
// sticks of butter become grams or kg; °F becomes °C and inches become cm. Teaspoons and
// tablespoons stay as they are, since metric kitchens use them too. The choice is remembered on
// this device. Ingredient amounts are converted by recipe-scaling.js (so they follow the servings),
// using toMetric() from here; this file converts the text of the steps.

var UNIT_FACTORS = {
  // to mL
  cup: { to: 'mL', factor: 236.588 },
  quart: { to: 'mL', factor: 946.353 },
  pint: { to: 'mL', factor: 473.176 },
  gallon: { to: 'mL', factor: 3785.41 },
  floz: { to: 'mL', factor: 29.5735 },
  // to g
  oz: { to: 'g', factor: 28.3495 },
  lb: { to: 'g', factor: 453.592 },
  stick: { to: 'g', factor: 113.398 }
}

// The ways recipes write each unit ("cups", "lbs.", "fl oz", ...)
var UNIT_WORDS = '(fl\\.? ?oz\\.?|fluid ounces?|cups?|c\\.|quarts?|qts?\\.?|pints?|pts?\\.?|gallons?|gal\\.?|ounces?|oz\\.?|pounds?|lbs?\\.?|sticks?)'

function unitKey (word) {
  word = word.toLowerCase().replace(/\.$/, '')
  if (/^(fl\.? ?oz|fluid)/.test(word)) return 'floz'
  if (/^(cup|c$)/.test(word)) return 'cup'
  if (/^(quart|qt)/.test(word)) return 'quart'
  if (/^(pint|pt)/.test(word)) return 'pint'
  if (/^gal/.test(word)) return 'gallon'
  if (/^(ounce|oz)/.test(word)) return 'oz'
  if (/^(pound|lb)/.test(word)) return 'lb'
  if (/^stick/.test(word)) return 'stick'
  return null
}

function roundTo (value, step) {
  var rounded = Math.round(value / step) * step
  return Math.round(rounded * 100) / 100
}

// A friendly metric amount: 236.6 mL -> "240 mL", 1656 mL -> "1.65 L", 14.2 g -> "14 g".
// `scaleBy` picks the unit from another value (so both ends of "2 to 3 lb" use the same unit).
function formatMetric (value, unit, scaleBy) {
  var big = (scaleBy || value) >= 1000
  if (big) {
    value = value / 1000
    unit = unit === 'mL' ? 'L' : 'kg'
    return { value: roundTo(value, value < 10 ? 0.05 : 1), unit: unit }
  }
  var step = value < 20 ? 1 : value < 100 ? 5 : 10
  return { value: Math.max(roundTo(value, step), 1), unit: unit }
}

// toMetric(2, "cups") -> { value: 470, unit: "mL" }; toMetric(1, "tsp") -> null (left alone)
// Metric recipes weigh dry and solid ingredients, so a cup of these becomes grams (weight of one
// US cup, mostly from King Arthur's and the USDA's tables). The first match wins, so specific
// names come before general ones. Liquids, and anything not listed, stay in mL.
var GRAMS_PER_CUP = [
  [/whole[- ]wheat flour/, 113],
  [/flour|bisquick|baking mix/, 120],
  [/powdered sugar|confectioner/, 115],
  [/brown sugar/, 215],
  [/sugar/, 200],
  [/peanut butter/, 260],
  [/\bbutter\b|margarine/, 227],
  [/shortening/, 184],
  [/cocoa/, 85],
  [/quick oats|instant oats/, 80],
  [/oats/, 90],
  [/rice/, 190],
  [/cornmeal|polenta/, 140],
  [/chocolate chips|\bchips\b|toffee/, 170],
  [/pecans|walnuts|almonds|peanuts|\bnuts\b/, 115],
  [/graham/, 100],
  [/parmesan/, 100],
  [/feta/, 150],
  [/cottage cheese|ricotta/, 225],
  [/cream cheese/, 230],
  [/sour cream/, 230],
  [/greek yogurt/, 280],
  [/yogurt/, 245],
  [/cheese|cheddar|mozzarella|gruy[eè]re|monterey/, 113],
  [/\bsalt\b/, 290],
  [/\bjam\b|preserves|jelly/, 320],
  [/honey/, 340],
  [/french fried onions/, null],
  [/green onion|scallion/, 100],
  [/onion|shallot/, 160],
  [/celery/, 100],
  [/bell pepper|peppers?\b/, 150],
  [/broccoli|cauliflower/, 90],
  [/tomato(es)?\b(?! sauce| paste| juice)/, 150],
  [/lettuce|romaine|spinach|kale/, 50],
  [/cilantro/, 16],
  [/parsley|basil|herbs/, 60],
  [/olives/, 135],
  [/carrots?/, 130],
  [/(cooked|shredded|chopped|diced).{0,12}(chicken|turkey|pork|beef)|(chicken|turkey)(?! broth| stock| base)/, 140]
]
// Never weighed, even when the name also mentions something above ("chicken broth", "heavy cream")
var LIQUIDS = /broth|stock|\bbase\b|milk|water|juice|wine|vinegar|\boil\b|syrup|sauce|salsa|heavy cream|whipping cream|half[- ]and[- ]half|coffee|beer|soda|ketchup/

function isLiquid (name) {
  name = String(name || '').toLowerCase().replace(/\([^)]*\)/g, ' ')
  return !/sour cream|cream cheese/.test(name) && LIQUIDS.test(name)
}

// Weight of one US cup of an ingredient, from its name; null when it's a liquid or not known.
function gramsPerCup (name) {
  name = String(name || '').toLowerCase().replace(/<[^>]+>/g, ' ')
  // Only the ingredient itself, not notes in brackets ("(See "Chicken")")
  name = name.replace(/\([^)]*\)/g, ' ')
  // "sour cream" and "cream cheese" are weighed even though "cream" is a liquid
  var solidCream = /sour cream|cream cheese/.test(name)
  if (!solidCream && LIQUIDS.test(name)) return null
  for (var i = 0; i < GRAMS_PER_CUP.length; i++) {
    if (GRAMS_PER_CUP[i][0].test(name)) return GRAMS_PER_CUP[i][1]
  }
  return null
}

// US cups in one of each volume unit
var CUPS_PER = { cup: 1, quart: 4, pint: 2, gallon: 16, floz: 1 / 8 }

// toMetric(2, "cups") -> { value: 470, unit: "mL" }; toMetric(2, "cups", null, "flour") ->
// { value: 240, unit: "g" }; toMetric(1, "tsp") -> null (left alone)
function toMetric (amount, word, scaleBy, ingredient) {
  var key = unitKey(word)
  if (!key || !(amount > 0)) return null
  // Only cups are weighed: a gallon or quart of vegetables is a jar size, not an amount to weigh
  var grams = key === 'cup' && ingredient ? gramsPerCup(ingredient) : null
  // Ounces of a liquid are fluid ounces ("6 oz of the beef broth"), but cans and jars are
  // labeled by weight ("1 (15 oz) can tomato sauce")
  if (key === 'oz' && ingredient && isLiquid(ingredient) && !/\b(cans?|jars?|packages?|pkgs?|bags?|box|boxes|bottles?|cartons?)\b/i.test(ingredient)) {
    key = 'floz'
  }
  if (grams) {
    var perUnit = grams * CUPS_PER[key]
    return formatMetric(amount * perUnit, 'g', scaleBy ? scaleBy * perUnit : null)
  }
  var unit = UNIT_FACTORS[key]
  return formatMetric(amount * unit.factor, unit.to, scaleBy ? scaleBy * unit.factor : null)
}

// Numbers as recipes write them: "1 1/2", "1½", "3-3/4", "½", "2.5"
var UNIT_FRACTIONS = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 }
var UNIT_NUMBER = '(?:\\d+[\\s-]+\\d+\\/\\d+|\\d+\\/\\d+|\\d*[½¼¾⅓⅔⅛⅜⅝⅞]|\\d+(?:\\.\\d+)?)'

function unitNumber (text) {
  text = text.trim()
  var mixed = text.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  if (text.indexOf('/') > 0) {
    var parts = text.split('/')
    return Number(parts[0]) / Number(parts[1])
  }
  var last = text.slice(-1)
  if (UNIT_FRACTIONS[last] !== undefined) return (Number(text.slice(0, -1)) || 0) + UNIT_FRACTIONS[last]
  return Number(text)
}

function showNumber (value) {
  return String(value)
}

function fahrenheitToCelsius (f) {
  var c = (f - 32) * 5 / 9
  // Oven temperatures to the nearest 5; meat and candy temperatures to the degree
  return f >= 200 ? roundTo(c, 5) : Math.round(c)
}

function inchesToMetric (inches) {
  var cm = inches * 2.54
  if (cm < 1) return Math.round(cm * 10) + ' mm'
  return (cm < 5 ? roundTo(cm, 0.5) : Math.round(cm)) + ' cm'
}

var RANGE = '(\\s*(?:-|–|to)\\s*)'
var TEMPERATURE = new RegExp('(\\d+)(?:' + RANGE + '(\\d+))?\\s*(?:°\\s*F\\b|degrees\\s*F\\b|° ?F|degrees(?! C))', 'g')
var INCHES = new RegExp('(' + UNIT_NUMBER + ')(?:' + RANGE + '(' + UNIT_NUMBER + '))?([- ])(?:inch(?:es)?|in\\.)(?![a-z])', 'gi')
// "pint sized jars" and "13-gallon bag" are sizes, not amounts
var NOT_A_SIZE = '(?![a-z])(?!\\s*-?\\s*sized)'
var AMOUNT = new RegExp('(^|[^\\w/.])(' + UNIT_NUMBER + ')(?:' + RANGE + '(' + UNIT_NUMBER + '))?\\s?' + UNIT_WORDS + NOT_A_SIZE, 'gi')

// Converts temperatures, sizes and amounts written in running text:
// "Bake at 350°F in a 9-inch pan" -> "Bake at 175°C in a 23 cm pan"
// `context`: what the text is about when it doesn't say, like an ingredient line whose bracket
// reads "(4 cups)"
function textToMetric (text, context) {
  text = text.replace(TEMPERATURE, function (all, from, range, to) {
    return fahrenheitToCelsius(Number(from)) + (to ? range + fahrenheitToCelsius(Number(to)) : '') + '°C'
  })
  text = text.replace(INCHES, function (all, from, range, to, joiner) {
    var low = inchesToMetric(unitNumber(from))
    if (!to) return low
    var high = inchesToMetric(unitNumber(to))
    return low.replace(/ (cm|mm)$/, '') + range + high
  })
  text = text.replace(AMOUNT, function (all, before, from, range, to, word, offset, whole) {
    // What's being measured: the words after the amount, up to the end of the phrase
    // ("¾ cup of the sugar and the salt" -> "of the sugar and the salt")
    var what = whole.slice(offset + all.length).split(/[,.;:()]/)[0].slice(0, 40)
    if (context && !gramsPerCup(what) && !isLiquid(what)) what = context
    var high = to ? unitNumber(to) : null
    var low = toMetric(unitNumber(from), word, high, what)
    if (!low) return all
    if (!to) return before + showNumber(low.value) + ' ' + low.unit
    var top = toMetric(high, word, high, what)
    return before + showNumber(low.value) + range + showNumber(top.value) + ' ' + top.unit
  })
  return text
}

if (typeof document !== 'undefined') (function () {
  var Cookbook = window.Cookbook
  var KEY = 'cookbook-units'
  var listeners = []
  var system = Cookbook.storage.get(KEY, 'us') === 'metric' ? 'metric' : 'us'

  // Every text in the steps (and notes) that reads differently in metric, with both versions
  var texts = []
  var method = document.querySelector('.recipe-method')
  if (method) {
    var walker = document.createTreeWalker(method, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      var node = walker.currentNode
      var metric = textToMetric(node.nodeValue)
      if (metric !== node.nodeValue) texts.push({ node: node, us: node.nodeValue, metric: metric })
    }
  }

  var buttons = document.querySelectorAll('.unit-toggle button')

  function apply () {
    texts.forEach(function (text) { text.node.nodeValue = text[system] })
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.units === system ? 'true' : 'false')
    })
    listeners.forEach(function (listener) { listener(system) })
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.dataset.units === system) return
      system = button.dataset.units
      Cookbook.storage.set(KEY, system === 'metric' ? 'metric' : null)
      apply()
    })
  })

  Cookbook.units = {
    get system () { return system },
    onChange: function (listener) { listeners.push(listener) }
  }
  apply()
})()

// Lets the unit tests load this file in Node
if (typeof module !== 'undefined') {
  module.exports = { UNIT_WORDS, toMetric, textToMetric, formatMetric, gramsPerCup, unitKey, unitNumber, fahrenheitToCelsius, inchesToMetric }
}
