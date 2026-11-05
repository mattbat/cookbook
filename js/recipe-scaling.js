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
var leading_amount = /^(?:\d+\s+(?:\d+\/\d+|[¼-¾⅐-⅞])|\d+\/\d+|\d+\.\d+|\d*[¼-¾⅐-⅞↉]|\d+)/

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
    var name, amount
    if (match) {
      name = rest.slice(match[0].length)
      amount = parse_number(match[0])
    } else {
      prefix = ''
      name = text
    }

    ingredients.push({
      el,
      amount,
      prefix,
      name
    })
  })

  return ingredients
}

function renderIngredientsAtScale (scale) {
  var scaleFactor = scale / initialScale

  initialIngredients.forEach((ingredient) => {
    // Items without an amount are never rewritten
    if (!ingredient.amount) {
      return
    }
    ingredient.el.innerHTML = ingredientToHTML(ingredient, scaleFactor)
  })
}

function ingredientToHTML (ingredient, scaleFactor) {
  if (ingredient.amount) {
    return `${ingredient.prefix || ''}<span class="scaled" title="${render_number(ingredient.amount)} (org) x ${render_number(scaleFactor)} (scaling)">${render_number(ingredient.amount * scaleFactor, 2)}</span>${ingredient.name}`
  } else {
    return ingredient.name
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
  var initialIngredients = getIngredients(document.querySelectorAll('.recipe ul > li'))

  var input = document.querySelector('input[name="recipe_scaling"]')
  if (input) {
    var initialScale = parse_number(input.value)
    input.addEventListener('change', function () {
      renderIngredientsAtScale(parse_number(input.value))
    })
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
