var vulgar_fractions = {
  '\u2189': 0/3,
  '\u2152': 1/10,
  '\u2151': 1/9,
  '\u215B': 1/8,
  '\u2150': 1/7,
  '\u2159': 1/6,
  '\u2155': 1/5,
  '\u00BC': 1/4,
  '\u2153': 1/3,
  '\u215C': 3/8,
  '\u2156': 2/5,
  '\u00BD': 1/2,
  '\u2157': 3/5,
  '\u215D': 5/8,
  '\u2154': 2/3,
  '\u00BE': 3/4,
  '\u2158': 4/5,
  '\u215A': 5/6,
  '\u215E': 7/8
}
function round_to(number, digits = 2) {
  var factor = Math.pow(10, digits)
  return Math.round(number * factor) / factor
}

function replace_vulgar_with_decimal (string) {
  // Find and replace any vulgar fractions
  for (const fracChar in vulgar_fractions) {
    // Round to 2 decimal places and convert to string
    var decimal = round_to(vulgar_fractions[fracChar], 2).toString()
    // Remove first character for parsing of e.g. 1 1/2 to work (this is always a zero)
    decimal = decimal.substr(1)

    string = string.replace(fracChar, decimal)
  }

  return string
}

function parse_number (number_string) {
  number_string = number_string.trim()

  // Mixed number like "1 1/2" or "1 ½"
  var parts = number_string.split(/\s+/)
  if (parts.length > 1) {
    return parts.reduce((sum, part) => sum + parse_number(part), 0)
  }

  if (number_string.indexOf('/') > 0) {
    // Fraction with a slash
    var partials = number_string.split('/')
    return parseFloat(partials[0]) / parseFloat(partials[1])
  }

  // Find and replace fraction characters
  number_string = replace_vulgar_with_decimal(number_string)

  return parseFloat(number_string)
}

function render_number (number, precision = 2) {
  number = round_to(number, precision)

  // When matching a vulgar fraction this much offset is ok
  var allowed_offset = 1.1 / Math.pow(10, precision)

  var frac = round_to(number % 1, precision)
  if (frac > 0) {
    for (const fracChar in vulgar_fractions) {
      if (Math.abs(round_to(vulgar_fractions[fracChar], precision) - frac) <= allowed_offset) {
        var rest = Math.floor(number)
        if (rest > 0) {
          return rest.toString() + fracChar
        } else {
          return fracChar
        }
      }
    }
  }

  return number.toString()
}

// Whitespace and opening tags (e.g. the <p> of a loose list) before an item's text
var leading_markup = /^(?:\s|&nbsp;|<[a-zA-Z][^>]*>)*/
// An amount at the start of an item's text: "1 1/2", "1 ½", "1/2", "2.5", "1½", "½" or "2"
var amount_pattern = '(?:\\d+\\s+(?:\\d+\\/\\d+|[¼-¾⅐-⅞])|\\d+\\/\\d+|\\d+\\.\\d+|\\d*[¼-¾⅐-⅞↉]|\\d+)'
var leading_amount = new RegExp('^' + amount_pattern)
// A range right after the amount: "2 to 3", "2-3" or "2–3" (both ends get scaled)
var range_end = new RegExp('^(\\s+to\\s+|\\s*[-–]\\s*)(' + amount_pattern + ')(?![\\d/])')

function getIngredients (entries) {
  var ingredients = []

  entries.forEach(function (el) {
    for (var child of el.childNodes) {
      if (child.nodeName.toLowerCase() === 'ul') {
        return
      }
    }

    // Only a number at the very start of the item's text is its amount, so
    // numbers later in the text, in links or in tag attributes are left alone
    var text = el.innerHTML
    var prefix = text.match(leading_markup)[0]
    var rest = text.slice(prefix.length)
    var match = rest.match(leading_amount)
    var name, amount, amountTo, separator
    if (match) {
      name = rest.slice(match[0].length)
      amount = parse_number(match[0])
      var range = name.match(range_end)
      if (range) {
        separator = range[1]
        amountTo = parse_number(range[2])
        name = name.slice(range[0].length)
      }
    } else {
      prefix = ''
      name = text
    }

    ingredients.push({
      el,
      amount,
      amountTo,
      separator,
      prefix,
      name
    })
  })

  return ingredients
}

// Metric conversion (js/units.js; loaded before this file on the page, required in the tests)
var units = typeof module !== 'undefined' && typeof require === 'function'
  ? require('./units.js')
  : { toMetric: window.toMetric, textToMetric: window.textToMetric, UNIT_WORDS: window.UNIT_WORDS }
var leading_unit = units.UNIT_WORDS ? new RegExp('^(\\s*)' + units.UNIT_WORDS + '(?![a-z])', 'i') : null

function renderIngredientsAtScale (scale, system) {
  var scaleFactor = scale / initialScale

  initialIngredients.forEach((ingredient) => {
    var html = ingredientToHTML(ingredient, scaleFactor, system)
    // Items without an amount are only rewritten when metric changes them
    if (!ingredient.amount && html === ingredient.el.innerHTML) return
    ingredient.el.innerHTML = html
  })
}

// `system`: 'metric' converts "2 cups" to "470 mL", "1 lb" to "450 g" (teaspoons and
// tablespoons stay), and amounts later in the text like "(15 oz)".
function ingredientToHTML (ingredient, scaleFactor, system) {
  var metric = system === 'metric' && units.toMetric
  var name = ingredient.name
  if (ingredient.amount) {
    var title = `${render_number(ingredient.amount)} (org) x ${render_number(scaleFactor)} (scaling)`
    var low = ingredient.amount * scaleFactor
    var high = ingredient.amountTo ? ingredient.amountTo * scaleFactor : null
    var scaled = render_number(low, 2) + (high ? ingredient.separator + render_number(high, 2) : '')
    var unitMatch = metric && leading_unit && name.match(leading_unit)
    var converted = unitMatch && units.toMetric(low, unitMatch[2], high)
    if (converted) {
      scaled = converted.value + (high ? ingredient.separator + units.toMetric(high, unitMatch[2], high).value : '')
      name = ' ' + converted.unit + units.textToMetric(name.slice(unitMatch[0].length))
    } else if (metric) {
      name = units.textToMetric(name)
    }
    return `${ingredient.prefix || ''}<span class="scaled" title="${title}">${scaled}</span>${name}`
  } else {
    return metric ? units.textToMetric(name) : name
  }
}

var value_steps = [.1, .25, .33, .5, .67, .75, .8, 1, 2]
function nextServings (value, direction) {
  if (value >= 2) {
    // We can do full number steps
    if (direction === 'up') {
      value++
    } else if (direction === 'down') {
      value--
    }
  } else {
    // We're in the small number zone, only jump between value_steps
    var i = 0;
    while (value > value_steps[i]) {
      i++
    }
    if (direction === 'up') {
      if (round_to(value, 2) === value_steps[i]) {
        i++
      }
    } else if (direction === 'down') {
      if (i > 0) {
        i--
      }
    }
    value = value_steps[i]
  }

  return value
}

if (typeof document !== 'undefined') {
  var initialIngredients = getIngredients(document.querySelectorAll('.recipe-ingredients ul > li'))

  var input = document.querySelector('input[name="recipe_scaling"]')
  if (input) {
    var initialScale = parse_number(input.value)
    var currentSystem = function () { return window.Cookbook && Cookbook.units ? Cookbook.units.system : 'us' }
    input.addEventListener('change', function () {
      renderIngredientsAtScale(parse_number(input.value), currentSystem())
    })
    if (window.Cookbook && Cookbook.units) {
      Cookbook.units.onChange(function (system) { renderIngredientsAtScale(parse_number(input.value), system) })
      if (currentSystem() === 'metric') renderIngredientsAtScale(initialScale, 'metric')
    }
  }

  var changeValue = function (direction) {
    input.value = render_number(nextServings(parse_number(input.value), direction))
    input.dispatchEvent(new Event('change'));
  }

  var decreaseButton = document.querySelector('.decrease')
  if (decreaseButton) {
    decreaseButton.addEventListener('click', () => changeValue('down'))
  }
  var increaseButton = document.querySelector('.increase')
  if (increaseButton) {
    increaseButton.addEventListener('click', () => changeValue('up'))
  }
}

// Lets the unit tests load this file in Node
if (typeof module !== 'undefined') {
  module.exports = { parse_number, render_number, nextServings, getIngredients, ingredientToHTML }
}
