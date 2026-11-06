// Checks the built site in _site/ (run `npm run build` first).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const root = path.resolve(import.meta.dirname, '../..')
const site = path.join(root, '_site')
const PREFIX = '/cookbook/'
const { imageSize } = createRequire(import.meta.url)('../../lib/images.js')
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

  test('every entry has a title, a working url, ingredients and steps to search', () => {
    for (const entry of list) {
      assert.ok(entry.title, JSON.stringify(entry))
      assert.ok(fs.existsSync(fileFor(entry.url)), `${entry.url} does not exist`)
      assert.ok(entry.ingredients.length > 20, `${entry.title} has no ingredients to search`)
      assert.ok(entry.text.length > 20, `${entry.title} has no steps to search`)
    }
  })

  test('the search page lists every recipe (so it works without JavaScript)', () => {
    const page = read(PREFIX + 'search/')
    for (const entry of list) assert.ok(page.includes(`data-url="${entry.url.replace(/'/g, '&#39;')}"`), entry.url)
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

describe('recipe data for Google and recipe apps (JSON-LD)', () => {
  const recipePages = htmlFiles(path.join(site, 'recipes'))

  for (const file of recipePages) {
    const name = path.relative(site, file).split(path.sep).join('/')
    test(`${name} describes itself as a Recipe`, () => {
      const html = fs.readFileSync(file, 'utf8')
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      assert.equal(blocks.length, 1, 'expected one JSON-LD block')
      const data = JSON.parse(blocks[0][1])
      assert.equal(data['@context'], 'https://schema.org')
      assert.equal(data['@type'], 'Recipe')
      assert.ok(data.name, 'no name')
      assert.equal(data.name, decode(html.match(/<h1>([^<]*)<\/h1>/)[1]), 'name differs from the page title')
      assert.ok(data.url.startsWith('https://mattbat.com' + PREFIX), `url ${data.url}`)
      assert.ok(Array.isArray(data.image) && data.image.length === 1, 'no image')
      assert.ok(fs.existsSync(fileFor(new URL(data.image[0]).pathname)), `image ${data.image[0]} is not in _site`)
      assert.ok(data.recipeIngredient.length > 0, 'no ingredients')
      assert.ok(data.recipeInstructions.length > 0, 'no steps')
      assert.equal(data.recipeInstructions.length, (html.match(/<ol class="steps"[\s\S]*?<\/ol>/g) || [])
        .join('').match(/<li>/g).length - nestedSteps(html), 'step count differs from the page')
      for (const step of data.recipeInstructions) {
        assert.equal(step['@type'], 'HowToStep')
        assert.ok(step.text && !/[<>]/.test(step.text), `step isn't plain text: ${step.text}`)
      }
      for (const key of ['prepTime', 'cookTime', 'totalTime']) {
        if (data[key]) assert.match(data[key], /^PT(\d+H)?(\d+M)?$/, `${key} ${data[key]}`)
      }
    })
  }

  test('Notes lists are not marked as steps', () => {
    const html = read(PREFIX + 'recipes/gumbo/')
    const notes = html.slice(html.indexOf('id="notes"'))
    assert.ok(!notes.includes('class="steps"'))
    assert.equal((html.match(/<ol class="steps"/g) || []).length, 1)
  })
})

// <li>s inside a nested list in a step (rare) aren't separate steps
function nestedSteps (html) {
  const lists = html.match(/<ol class="steps"[\s\S]*?<\/ol>/g) || []
  return lists.reduce((count, list) => {
    const nested = list.match(/<li>[\s\S]*?<(ul|ol)>[\s\S]*?<\/\1>/g) || []
    return count + nested.reduce((n, item) => n + (item.match(/<li>/g).length - 1), 0)
  }, 0)
}

describe('smaller photos (srcset)', () => {
  const pages = htmlFiles()
  const imgTags = pages.flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(/<img\b[^>]*>/g)]
    .map((match) => ({ file: path.relative(site, file).split(path.sep).join('/'), tag: match[0] })))
  const recipePhotos = imgTags.filter(({ tag }) => /\ssrc="\/cookbook\/img\/w\//.test(tag))

  test('recipe photos use the smaller copies', () => {
    assert.ok(recipePhotos.length > 50, `only ${recipePhotos.length} photos use the copies`)
    const originals = imgTags.filter(({ tag }) => /\ssrc="\/cookbook\/img\/[^w/][^"]*\.(jpe?g|png)"/i.test(tag))
    assert.deepEqual(originals.map(({ file, tag }) => `${file}: ${tag}`), [], 'pages still loading full-size photos')
  })

  test('every copy in a srcset exists, with the width it claims', () => {
    const checked = new Set()
    for (const { file, tag } of recipePhotos) {
      const srcset = tag.match(/\ssrcset="([^"]+)"/)
      assert.ok(srcset, `${file}: no srcset on ${tag}`)
      assert.ok(/\ssizes="[^"]+"/.test(tag), `${file}: no sizes on ${tag}`)
      for (const entry of srcset[1].split(', ')) {
        const [url, width] = entry.split(' ')
        if (checked.has(url)) continue
        checked.add(url)
        const copy = fileFor(url)
        assert.ok(fs.existsSync(copy), `${url} is missing`)
        assert.equal(imageSize(copy).width + 'w', width, `${url} isn't ${width} wide`)
      }
    }
  })

  test('the copies are much smaller than the originals', () => {
    const total = (dir, pattern) => fs.readdirSync(dir).filter((name) => pattern.test(name))
      .reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0)
    const originals = total(path.join(site, 'img'), /\.(jpe?g|png)$/i)
    const phoneSize = total(path.join(site, 'img', 'w'), /-480\.jpg$/)
    assert.ok(phoneSize < originals / 10, `phone-size copies are ${phoneSize} bytes vs ${originals} for the originals`)
  })
})

describe('installable app (manifest and icons)', () => {
  const manifest = JSON.parse(read(PREFIX + 'manifest.webmanifest'))

  test('every page links the manifest and home-screen icon', () => {
    for (const file of htmlFiles()) {
      const html = fs.readFileSync(file, 'utf8')
      if (/http-equiv="refresh"/.test(html)) continue
      assert.ok(html.includes(`<link rel="manifest" href="${PREFIX}manifest.webmanifest">`), `${file} has no manifest link`)
      assert.ok(html.includes(`<link rel="apple-touch-icon" href="${PREFIX}icons/apple-touch-icon.png">`), `${file} has no apple-touch-icon`)
    }
  })

  test('the manifest opens the cookbook full screen', () => {
    assert.equal(manifest.start_url, PREFIX)
    assert.equal(manifest.scope, PREFIX)
    assert.equal(manifest.display, 'standalone')
    assert.ok(manifest.name && manifest.short_name.length <= 12)
  })

  test('the manifest icons exist at the sizes it says', () => {
    assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
    for (const icon of [...manifest.icons, { src: PREFIX + 'icons/apple-touch-icon.png', sizes: '180x180' }]) {
      const file = fileFor(icon.src)
      assert.ok(fs.existsSync(file), `${icon.src} is missing`)
      const size = imageSize(file)
      assert.equal(`${size.width}x${size.height}`, icon.sizes, icon.src)
    }
  })

  test('shortcuts go to pages that exist', () => {
    for (const shortcut of manifest.shortcuts) assert.ok(fs.existsSync(fileFor(shortcut.url)), shortcut.url)
  })
})

describe('offline copy (service worker)', () => {
  const sw = read(PREFIX + 'sw.js')

  test('is valid JavaScript with a version from this build', () => {
    assert.doesNotThrow(() => new Function(sw))
    assert.match(sw, /const VERSION = '[a-z0-9]+'/)
    assert.match(sw, /const BASE = '\/cookbook\/'/)
  })

  test('everything it saves up front exists', () => {
    const list = sw.match(/const PRECACHE = \[([\s\S]*?)\]/)[1]
    const paths = [...list.matchAll(/'([^']*)'/g)].map((match) => PREFIX + match[1])
    assert.ok(paths.length > 10)
    for (const url of paths) assert.ok(fs.existsSync(fileFor(url)), `${url} is in PRECACHE but not in the site`)
  })

  test('there is an offline page, kept out of the sitemap', () => {
    assert.match(read(PREFIX + 'offline/'), /You’re offline/)
    assert.ok(!read(PREFIX + 'sitemap.xml').includes('offline'))
  })
})

test('Claude Code files (.claude/, like the add-recipe skill) are not published', () => {
  assert.ok(!fs.existsSync(path.join(site, '.claude')), '_site/.claude exists; add .claude/** to the ignores in eleventy.config.mjs')
})
