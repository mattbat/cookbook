const fs = require('fs')
const path = require('path')
const ejs = require('ejs')
const fetch = require('node-fetch')

const MARKDOWN_TEMPLATE = 'CLI/template.md.ejs'

const OUTPUT_DIR = '_recipes/'
const IMG_OUTPUT_DIR = 'img/'
const MARKDOWN_IMG_PREFIX = `../${IMG_OUTPUT_DIR}`

async function downloadImage(url, name) {
  if (!url) { return }

  // from https://stackoverflow.com/questions/6997262/how-to-pull-url-file-extension-out-of-url-string-using-javascript
  const fileType = url.split(/\#|\?/)[0].split('.').pop().trim()
  const filename = `${name}.${fileType}`
  const filepath = path.join(IMG_OUTPUT_DIR, filename)

  const response = await fetch(url)

  const stream = fs.createWriteStream(filepath)
  response.body.pipe(stream)

  return filepath
}

function simplifyRecipeJSON (recipe) {
  return {
    recipe: recipe,
    ingredients: recipe.extendedIngredients || [],
    instructions: recipe.analyzedInstructions.length > 0 ? recipe.analyzedInstructions[0].steps : [],
    tags: extractTags(recipe),
  }
}

async function recipeToMarkdown(recipe) {
  const markdownTemplateString = await fs.promises.readFile(MARKDOWN_TEMPLATE, 'utf8')

  return ejs.render(markdownTemplateString, recipe)
}

async function saveRecipeMarkdown(renderedRecipe, safeTitle) {
  // "Grandma's Pot Roast" -> "grandmas-pot-roast.md" (the recipe's web address comes from this)
  const filename = safeTitle.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const filepath = `${OUTPUT_DIR}/${filename}.md`

  await fs.promises.writeFile(filepath, renderedRecipe)

  return filepath
}

const BINARY_TAGS = ['vegetarian', 'vegan', 'glutenFree', 'dairyFree', 'ketogenic']
function extractTags(recipeJson) {
  let tags = []
  BINARY_TAGS.forEach((val) => {
    if (recipeJson[val]) { tags.push(val) }
  })

  tags = tags.concat(recipeJson.cuisines || [])

  tags = tags.map(x => x.toLowerCase())

  return tags
}

module.exports = {
  downloadImage,
  simplifyRecipeJSON,
  recipeToMarkdown,
  saveRecipeMarkdown,
  extractTags
}
