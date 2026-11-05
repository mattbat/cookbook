// Checks the built site in _site/ (run `npm run build` first).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const site = path.join(root, '_site')
const PREFIX = '/cookbook/'
const live = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/live-site.json'), 'utf8'))

assert.ok(fs.existsSync(site), 'no _site folder; run `npm run build` first')

// "/cookbook/recipes/gumbo/" -> "_site/recipes/gumbo/index.html"
function fileFor (url) {
  const clean = decodeURIComponent(url.split(/[?#]/)[0]).slice(PREFIX.length)
  const file = path.join(site, clean)
  return clean === '' || clean.endsWith('/') ? path.join(file, 'index.html') : file
}

function read (url) {
  return fs.readFileSync(fileFor(url), 'utf8')
}

function decode (text) {
  return text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
}

function htmlFiles (dir = site) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return htmlFiles(full)
    return entry.name.endsWith('.html') ? [full] : []
  })
}

describe('links people already have still work', () => {
  for (const url of live.pages) {
    test(url, () => assert.ok(fs.existsSync(fileFor(url)), `${url} is missing from the build`))
  }

  for (const recipe of live.recipes) {
    test(`${recipe.url} is still "${recipe.title}"`, () => {
      assert.ok(fs.existsSync(fileFor(recipe.url)), `${recipe.url} is missing from the build`)
      const h1 = read(recipe.url).match(/<h1>([^<]*)<\/h1>/)
      assert.equal(decode(h1[1]), recipe.title)
    })
  }
})

describe('search index (list.json)', () => {
  const list = JSON.parse(read(PREFIX + 'list.json'))
  const recipeCount = fs.readdirSync(path.join(root, '_recipes')).filter((f) => f.endsWith('.md')).length

  test('has one entry per recipe', () => assert.equal(list.length, recipeCount))

  test('every entry has a title, a working url and a card', () => {
    for (const entry of list) {
      assert.ok(entry.title, JSON.stringify(entry))
      assert.ok(fs.existsSync(fileFor(entry.url)), `${entry.url} does not exist`)
      assert.match(entry.list_entry_html, /class="recipe-preview"/)
    }
  })
})

test('sitemap lists every recipe', () => {
  const sitemap = read(PREFIX + 'sitemap.xml')
  for (const recipe of live.recipes) {
    const loc = 'https://mattbat.com' + recipe.url.replace(/'/g, '&#39;')
    assert.ok(sitemap.includes(`<loc>${loc}</loc>`), `${recipe.url} missing from sitemap`)
  }
})

test('RSS feed is valid-looking and lists recipes', () => {
  const feed = read(PREFIX + 'feed.xml')
  assert.match(feed, /^<\?xml/)
  assert.ok((feed.match(/<item>/g) || []).length > 0)
})

test('no template code leaks into pages', () => {
  for (const file of htmlFiles()) {
    const html = fs.readFileSync(file, 'utf8')
    assert.ok(!/\{\{|\{%/.test(html), `${path.relative(site, file)} contains {{ or {%`)
  }
})

test('every link, photo, script and stylesheet on the site points somewhere real', () => {
  const problems = []
  const ids = new Map()
  const idsIn = (url) => {
    const file = fileFor(url)
    if (!ids.has(file)) ids.set(file, new Set([...fs.readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])))
    return ids.get(file)
  }

  for (const file of htmlFiles()) {
    const page = '/' + path.relative(site, file).replace(/\\/g, '/')
    const html = fs.readFileSync(file, 'utf8')
    for (const [, attr, raw] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
      const value = decode(raw)
      if (/^(https?:|mailto:|tel:|javascript:|data:|#$)/.test(value)) continue
      if (value.startsWith('#')) {
        if (!idsIn(PREFIX + page.slice(1)).has(value.slice(1))) problems.push(`${page}: ${value} has no matching id`)
        continue
      }
      if (!value.startsWith(PREFIX)) {
        problems.push(`${page}: ${attr}="${value}" doesn't start with ${PREFIX}`)
        continue
      }
      if (!fs.existsSync(fileFor(value))) {
        problems.push(`${page}: ${value} not found`)
        continue
      }
      const hash = value.split('#')[1]
      if (hash && !idsIn(value).has(decodeURIComponent(hash))) problems.push(`${page}: ${value} has no matching id`)
    }
  }

  assert.deepEqual([...new Set(problems)], [])
})

describe('shared links (Open Graph)', () => {
  const recipePages = htmlFiles(path.join(site, 'recipes'))
  const metaContent = (html, property) => {
    const tag = html.match(new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`))
    return tag ? decode(tag[1]) : undefined
  }

  test('there are recipe pages', () => assert.ok(recipePages.length > 0))

  for (const file of recipePages) {
    const name = path.relative(site, file).replace(/\\/g, '/')
    test(`${name} has a photo that exists and a description`, () => {
      const html = fs.readFileSync(file, 'utf8')
      const image = metaContent(html, 'og:image')
      assert.ok(image, 'no og:image')
      assert.ok(image.startsWith('https://mattbat.com' + PREFIX), `og:image ${image} isn't a full site URL`)
      assert.ok(fs.existsSync(fileFor(new URL(image).pathname)), `og:image ${image} is not in _site`)
      const description = metaContent(html, 'og:description')
      assert.ok(description, 'empty og:description')
      assert.ok(!/Toggle navigation|By:|serving\(s\)/.test(description), `og:description looks like page chrome: ${description}`)
    })
  }

  test('no page refers to the old, missing avatar-icon.svg', () => {
    const offenders = htmlFiles().filter((file) => fs.readFileSync(file, 'utf8').includes('avatar-icon.svg'))
    assert.deepEqual(offenders.map((file) => path.relative(site, file)), [])
  })
})
