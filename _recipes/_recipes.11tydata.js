const fs = require('node:fs')
const matter = require('gray-matter')
const { recipeSlug, recipeTitle, recipeImage, recipeDescription } = require('../lib/recipes')

const bodies = new Map()
function body (data) {
  const path = data.page.inputPath
  if (!bodies.has(path)) bodies.set(path, matter(fs.readFileSync(path, 'utf8')).content)
  return bodies.get(path)
}

module.exports = {
  layout: 'recipe.njk',
  ogType: 'article',
  scripts: ['/js/recipe-scaling.js'],
  eleventyComputed: {
    // Keep the addresses the Jekyll site used, so links people already shared still work.
    permalink: (data) => `/recipes/${recipeSlug(data.page.fileSlug)}/`,
    title: (data) => recipeTitle(body(data)),
    photo: (data) => recipeImage(body(data)),
    // Shown in search results and link previews. Named `summary` because head.njk sets its own
    // `description` variable, which would hide a data value of that name.
    summary: (data) => recipeDescription({
      body: body(data),
      title: data.title,
      author: data.author,
      servings: data.servings,
      subtitle: data.subtitle
    })
  }
}
