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
    return { value: roundTo(value, value < 10 ? 0.05 : 0.1), unit: unit }
  }
  var step = value < 20 ? 1 : value < 100 ? 5 : 10
  return { value: Math.max(roundTo(value, step), 1), unit: unit }
}

// toMetric(2, "cups") -> { value: 470, unit: "mL" }; toMetric(1, "tsp") -> null (left alone)
function toMetric (amount, word, scaleBy) {
  var key = unitKey(word)
  if (!key || !(amount > 0)) return null
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
var AMOUNT = new RegExp('(^|[^\\w/.])(' + UNIT_NUMBER + ')(?:' + RANGE + '(' + UNIT_NUMBER + '))?\\s?' + UNIT_WORDS + '(?![a-z])', 'gi')

// Converts temperatures, sizes and amounts written in running text:
// "Bake at 350°F in a 9-inch pan" -> "Bake at 175°C in a 23 cm pan"
function textToMetric (text) {
  text = text.replace(TEMPERATURE, function (all, from, range, to) {
    return fahrenheitToCelsius(Number(from)) + (to ? range + fahrenheitToCelsius(Number(to)) : '') + '°C'
  })
  text = text.replace(INCHES, function (all, from, range, to, joiner) {
    var low = inchesToMetric(unitNumber(from))
    if (!to) return low
    var high = inchesToMetric(unitNumber(to))
    return low.replace(/ (cm|mm)$/, '') + range + high
  })
  text = text.replace(AMOUNT, function (all, before, from, range, to, word) {
    var high = to ? unitNumber(to) : null
    var low = toMetric(unitNumber(from), word, high)
    if (!low) return all
    if (!to) return before + showNumber(low.value) + ' ' + low.unit
    var top = toMetric(high, word, high)
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
  module.exports = { UNIT_WORDS, toMetric, textToMetric, formatMetric, unitKey, unitNumber, fahrenheitToCelsius, inchesToMetric }
}
