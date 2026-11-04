// Helpers shared by the Eleventy build and the tests, so both read recipe
// files exactly the same way.
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')

const PATH_PREFIX = '/cookbook/'

// Heading ids match the old Jekyll/kramdown ones ("Gumbo Ingredients" -> "gumbo-ingredients")
// so existing #links keep working.
function headingId (text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function createMarkdown () {
  return markdownIt({ html: true, linkify: true, typographer: true, breaks: true })
    .use(markdownItAnchor, { slugify: headingId, tabIndex: false })
}

// Tags are written freely ("slow cooker", "Greek"); this is the form used in links and
// for grouping, so "Greek" and "greek" are the same tag.
function tagId (tag) {
  return String(tag).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Same rules as Jekyll's "pretty" slugify, which built the current recipe URLs:
// "Moroccan Chickpea Soup" -> "Moroccan-Chickpea-Soup", "myles's_medium_salsa" is unchanged.
function recipeSlug (fileSlug) {
  return fileSlug
    .replace(/[^\p{L}\p{M}\p{Nd}._~!$&'()+,;=@-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

const TITLE_LINE = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m
const IMAGE = /!\[([^\]]*)\]\(\s*(?:\.\.\/)?(img\/[^)\s]+)\s*\)/

// Recipes start with "# Title"; that heading becomes the page title (as plain text, with
// typographic quotes like the old site: "Myles's" -> "Myles’s").
function recipeTitle (body, md = createMarkdown()) {
  const match = body.match(TITLE_LINE)
  if (!match) return undefined
  return md.renderInline(match[1])
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function stripTitle (body) {
  return body.replace(TITLE_LINE, '')
}

// The first photo in the recipe, as a site path like "/img/gumbo.jpeg".
function recipeImage (body) {
  const match = body.match(IMAGE)
  return match ? { src: '/' + match[2], alt: match[1] } : undefined
}

// Recipes link photos as "../img/x.jpeg" (relative to _recipes/); make that work from any page URL.
function absolutizeImages (body) {
  return body.replace(/(!\[[^\]]*\]\(\s*)\.\.\/img\//g, `$1${PATH_PREFIX}img/`)
}

module.exports = {
  PATH_PREFIX,
  headingId,
  tagId,
  createMarkdown,
  recipeSlug,
  recipeTitle,
  stripTitle,
  recipeImage,
  absolutizeImages
}
