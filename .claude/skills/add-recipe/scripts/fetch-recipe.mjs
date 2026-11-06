#!/usr/bin/env node
// Reads a recipe web page and prints the recipe as JSON.
//
//   node .claude/skills/add-recipe/scripts/fetch-recipe.mjs https://example.com/some-recipe
//
// Most recipe sites include schema.org Recipe data (the same kind this cookbook publishes) for
// Google; that's far more reliable than reading the page. Without it, prints the page's text and
// main photo so the recipe can be read from those instead.
import { pathToFileURL } from 'node:url'

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

// "PT1H30M" -> 90; "PT45M" -> 45; "P0DT2H" -> 120
export function isoMinutes (value) {
  if (!value || typeof value !== 'string') return null
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i)
  if (!match) return null
  const [, days, hours, minutes, seconds] = match.map((part) => Number(part) || 0)
  const total = Math.round(days * 1440 + hours * 60 + minutes + seconds / 60)
  return total > 0 ? total : null
}

const decodeEntities = (text) => String(text)
  .replace(/&#(\d+);/g, (all, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (all, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const clean = (text) => decodeEntities(String(text || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

const types = (node) => [].concat(node && node['@type'] || []).map(String)

// Every object in the JSON-LD (it may be a list, or nested under @graph)
function * walk (node) {
  if (Array.isArray(node)) {
    for (const item of node) yield * walk(item)
  } else if (node && typeof node === 'object') {
    yield node
    if (node['@graph']) yield * walk(node['@graph'])
  }
}

function imageUrl (image) {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return imageUrl(image[image.length > 1 ? 0 : 0])
  return image.url || image.contentUrl || null
}

function names (value) {
  return [].concat(value || []).map((item) => (typeof item === 'string' ? item : item && item.name)).filter(Boolean).map(clean)
}

// Steps as { section, text }; HowToSection groups keep their name ("For the sauce")
function steps (instructions, section = null) {
  const out = []
  for (const item of [].concat(instructions || [])) {
    if (typeof item === 'string') {
      // Some sites put every step in one string, separated by new lines
      for (const line of item.split(/\n+/)) if (clean(line)) out.push({ section, text: clean(line) })
    } else if (types(item).includes('HowToSection')) {
      out.push(...steps(item.itemListElement, clean(item.name) || section))
    } else if (item && (item.text || item.name)) {
      out.push({ section, text: clean(item.text || item.name) })
    } else if (item && item.itemListElement) {
      out.push(...steps(item.itemListElement, section))
    }
  }
  return out
}

// The schema.org Recipe in a page's HTML, tidied up; null if the page has none.
export function recipeFromHtml (html, url = null) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const [, json] of blocks) {
    let data
    try { data = JSON.parse(json.trim()) } catch (e) { continue }
    for (const node of walk(data)) {
      if (!types(node).includes('Recipe')) continue
      const yieldValue = [].concat(node.recipeYield || [])
      return {
        url: url || node.url || null,
        name: clean(node.name),
        description: clean(node.description) || null,
        author: names(node.author)[0] || null,
        publisher: names(node.publisher)[0] || null,
        servings: yieldValue.map(String).find((y) => /\d/.test(y)) || null,
        prepMinutes: isoMinutes(node.prepTime),
        cookMinutes: isoMinutes(node.cookTime),
        totalMinutes: isoMinutes(node.totalTime),
        ingredients: [].concat(node.recipeIngredient || node.ingredients || []).map(clean).filter(Boolean),
        steps: steps(node.recipeInstructions),
        keywords: [].concat(node.keywords || []).join(',').split(',').map((k) => clean(k)).filter(Boolean),
        category: [].concat(node.recipeCategory || []).map(clean),
        cuisine: [].concat(node.recipeCuisine || []).map(clean),
        image: imageUrl(node.image)
      }
    }
  }
  return null
}

// Without Recipe data: the page title, main photo and readable text
export function pageFromHtml (html, url = null) {
  const meta = (name) => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i'))
    const content = tag && tag[0].match(/content=["']([^"']*)["']/i)
    return content ? decodeEntities(content[1]) : null
  }
  const body = html
    .replace(/<(head|script|style|noscript|svg|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|li|h\d|div|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
  const text = decodeEntities(body.replace(/<[^>]+>/g, ' '))
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
  return {
    url,
    title: meta('og:title') || clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]) || null,
    image: meta('og:image'),
    siteName: meta('og:site_name'),
    text: text.slice(0, 20000)
  }
}

async function main (url) {
  if (!/^https?:\/\//.test(url || '')) {
    console.error('Usage: fetch-recipe.mjs https://example.com/some-recipe')
    process.exit(2)
  }
  const response = await fetch(url, { headers: { 'user-agent': BROWSER, accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' })
  if (!response.ok) {
    console.error(`Couldn't load ${url}: HTTP ${response.status} (some sites block scripts; read the page another way)`)
    process.exitCode = 1
    return
  }
  const html = await response.text()
  const recipe = recipeFromHtml(html, response.url)
  const page = recipe ? null : pageFromHtml(html, response.url)
  console.log(JSON.stringify(recipe ? { found: 'recipe-data', recipe } : { found: 'page-text-only', page }, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv[2]).catch((error) => {
    console.error(`Couldn't load the page: ${error.message}`)
    process.exitCode = 1
  })
}
