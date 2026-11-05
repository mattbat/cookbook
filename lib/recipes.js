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

// Markdown inline text -> plain text, with typographic quotes ("Myles's" -> "Myles’s").
function plainInline (text, md = createMarkdown()) {
  return md.renderInline(String(text))
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

// Recipes start with "# Title"; that heading becomes the page title (as plain text, with
// typographic quotes like the old site: "Myles's" -> "Myles’s").
function recipeTitle (body, md = createMarkdown()) {
  const match = body.match(TITLE_LINE)
  if (!match) return undefined
  return plainInline(match[1], md)
}

const LIST_ITEM = /^[ \t]*[-*+][ \t]+(.+?)[ \t]*$/
const END_OF_INGREDIENTS = /^#{1,6}[ \t]+(steps|directions|instructions|method|notes|videos|tools)\b/i

// The ingredient lines (bullet items before the Steps/Notes sections) as plain text, without
// side notes in brackets: '2 cups cooked chicken (See "Chicken")' -> "2 cups cooked chicken".
function recipeIngredients (body, md = createMarkdown()) {
  const items = []
  for (const line of body.split(/\r?\n/)) {
    if (END_OF_INGREDIENTS.test(line)) break
    const match = line.match(LIST_ITEM)
    if (!match) continue
    const text = plainInline(match[1], md)
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s+([,.;:])/g, '$1')
      .trim()
    if (text) items.push(text)
  }
  return items
}

// Shorten to at most `max` characters, cutting at a word boundary and ending with "…".
function truncateWords (text, max = 160) {
  text = String(text).replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > 0 ? cut.slice(0, space) : cut.slice(0, max - 1)).replace(/[\s,;:.\-–—]+$/, '') + '…'
}

function possessive (name) {
  return name + (/s$/i.test(name) ? '’' : '’s')
}

// A short description for search engines and shared links: the subtitle if there is one,
// otherwise "Tracy Batchelder’s Gumbo. Serves 8. 2 cups cooked chicken, 7 cups chicken stock, …".
// An author like "Carly Batchelder (The Machine Shed)" keeps the bracket after the title.
function recipeDescription ({ body, title, author, servings, subtitle }, max = 160, md = createMarkdown()) {
  if (subtitle && String(subtitle).trim()) return truncateWords(plainInline(subtitle, md), max)
  title = title || recipeTitle(body, md) || ''
  const parts = []
  const who = author ? String(author).trim().match(/^(.*?)\s*(\([^)]*\))?$/) : null
  if (who && who[1]) parts.push(`${possessive(who[1])} ${title}${who[2] ? ' ' + who[2] : ''}.`)
  else if (title) parts.push(`${title}.`)
  const amount = servings === undefined || servings === null ? '' : String(servings).trim()
  if (amount) parts.push(/^\d+(\.\d+)?$/.test(amount) ? `Serves ${amount}.` : `Makes ${amount}.`)
  const ingredients = recipeIngredients(body, md)
  if (ingredients.length) parts.push(ingredients.join(', ') + '.')
  return truncateWords(parts.join(' '), max)
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
  plainInline,
  recipeTitle,
  recipeIngredients,
  recipeDescription,
  truncateWords,
  stripTitle,
  recipeImage,
  absolutizeImages
}
