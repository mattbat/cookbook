const fs = require('node:fs')
const matter = require('gray-matter')
const { recipeSlug, recipeTitle, recipeImage } = require('../lib/recipes')

const bodies = new Map()
function body (data) {
  const path = data.page.inputPath
  if (!bodies.has(path)) bodies.set(path, matter(fs.readFileSync(path, 'utf8')).content)
  return bodies.get(path)
}

module.exports = {
  layout: 'recipe.njk',
  eleventyComputed: {
    // Keep the addresses the Jekyll site used, so links people already shared still work.
    permalink: (data) => `/recipes/${recipeSlug(data.page.fileSlug)}/`,
    title: (data) => recipeTitle(body(data)),
    photo: (data) => recipeImage(body(data))
  }
}
