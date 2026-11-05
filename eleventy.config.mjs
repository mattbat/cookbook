import path from 'node:path'
import recipes from './lib/recipes.js'
import images from './lib/images.js'

const { PATH_PREFIX, createMarkdown, stripTitle, absolutizeImages, tagId } = recipes

const { imageSize } = images

// Outline icons (24x24, stroked via CSS)
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 2 1.5 3 2.5 3 0-3-1-5 0-8z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'
}

// Splits a recipe's HTML at its "## " headings into ingredients (lists of things to gather) and
// method (steps, notes, videos, ...), so wide screens can show them side by side.
function recipeSections (html) {
  const parts = String(html).split(/(?=<h2[\s>])/)
  const intro = parts[0].startsWith('<h2') ? '' : parts.shift()
  const ingredients = []
  const method = []
  for (const part of parts) {
    const heading = (part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || ''
    const isIngredients = /ingredient/i.test(heading) ||
      (!/step|direction|instruction|method|note|video|tool/i.test(heading) && /<ul/.test(part) && !/<ol/.test(part))
    if (isIngredients) {
      ingredients.push(part)
    } else if (/step|direction|instruction|method/i.test(heading)) {
      // Mark the numbered lists that are the recipe's steps (not Notes), for cook mode and timers
      const label = heading.replace(/<[^>]+>/g, '').replace(/"/g, '&quot;').trim()
      method.push(part.replace(/<ol>/g, `<ol class="steps" data-section="${label}">`))
    } else {
      method.push(part)
    }
  }
  return {
    intro: intro.replace(/<p>\s*<img[^>]*>\s*<\/p>/, '').trim(),
    ingredients: ingredients.join(''),
    method: method.join('')
  }
}

const isRecipe = (inputPath) => inputPath.replace(/\\/g, '/').startsWith('./_recipes/')

export default function (eleventyConfig) {
  eleventyConfig.setLibrary('md', createMarkdown())

  // The "# Title" heading becomes the page title (shown by the layout), so drop it from the body.
  eleventyConfig.addPreprocessor('recipe-markdown', 'md', (data, content) => {
    if (!isRecipe(data.page.inputPath)) return content
    return absolutizeImages(stripTitle(content))
  })

  // Jekyll accepted loose dates like "2023-05-6"; keep accepting them.
  eleventyConfig.addDateParsing((value) => {
    const match = typeof value === 'string' && value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (match) return new Date(Date.UTC(match[1], match[2] - 1, match[3]))
  })

  eleventyConfig.addCollection('recipes', (api) => api.getFilteredByGlob('./_recipes/*.md'))

  // Give every local photo its real width/height so the page doesn't jump as photos load
  // (that jump is what sent category links to the wrong place), and lazy-load all but the first.
  eleventyConfig.addTransform('photo-sizes', function (html) {
    if (!(this.page.outputPath || '').endsWith('.html')) return html
    let first = true
    return html.replace(/<img\b[^>]*>/g, (tag) => {
      const src = tag.match(/\ssrc="([^"]+)"/)
      if (!src || !src[1].startsWith(PATH_PREFIX + 'img/')) return tag
      let attrs = ''
      const size = imageSize(path.join('img', decodeURIComponent(src[1].slice(PATH_PREFIX.length + 4)).replace(/&#39;/g, "'")))
      if (size && !/\swidth=/.test(tag)) attrs += ` width="${size.width}" height="${size.height}"`
      if (!first && !/\sloading=/.test(tag)) attrs += ' loading="lazy" decoding="async"'
      first = false
      return tag.replace(/^<img\b/, '<img' + attrs)
    })
  })

  eleventyConfig.addPassthroughCopy('css')
  eleventyConfig.addPassthroughCopy('js')
  eleventyConfig.addPassthroughCopy('img')
  eleventyConfig.addPassthroughCopy('favicon.ico')
  eleventyConfig.addPassthroughCopy({ 'node_modules/minisearch/dist/umd/index.js': 'js/vendor/minisearch.js' })

  eleventyConfig.addShortcode('icon', (name) =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`)

  // 90 -> "1 hr 30 min", 45 -> "45 min"; nothing for 0 or blank.
  eleventyConfig.addFilter('duration', (minutes) => {
    minutes = Number(minutes) || 0
    if (minutes <= 0) return ''
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return [hours && `${hours} hr`, rest && `${rest} min`].filter(Boolean).join(' ')
  })
  eleventyConfig.addFilter('totalMinutes', (data) => (Number(data.prep_time) || 0) + (Number(data.cooking_time) || 0))

  eleventyConfig.addFilter('recipeSections', recipeSections)
  eleventyConfig.addFilter('limit', (items, count) => items.slice(0, count))
  eleventyConfig.addFilter('isCurrent', (pageUrl, tabUrl) =>
    tabUrl === '/' ? pageUrl === '/' : pageUrl.startsWith(tabUrl))

  for (const path of ['README.md', 'CLI/**', 'lib/**', 'tests/**', '_recipes/_template/**', 'test-results/**', 'playwright-report/**']) {
    eleventyConfig.ignores.add(path)
  }

  const url = eleventyConfig.getFilter('url')

  eleventyConfig.addFilter('fullUrl', function (path) {
    return new URL(url(path), this.ctx.site.url).href
  })

  eleventyConfig.addFilter('readableDate', (date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }))
  eleventyConfig.addFilter('isoDate', (date) => new Date(date).toISOString().slice(0, 10))
  eleventyConfig.addFilter('rfc822Date', (date) => new Date(date).toUTCString())

  eleventyConfig.addFilter('isUrl', (value) => /^https?:\/\//i.test(String(value || '')))
  // "https://www.meatchurch.com/blogs/..." -> "www.meatchurch.com"
  eleventyConfig.addFilter('sourceName', (value) => String(value).replace(/^https?:\/\//i, '').split('/')[0])

  eleventyConfig.addFilter('byTitle', (items) => [...items].sort((a, b) => a.data.title.localeCompare(b.data.title)))
  eleventyConfig.addFilter('newestFirst', (items) => [...items].sort((a, b) => b.date - a.date))
  eleventyConfig.addFilter('tagId', tagId)
  // Recipes marked `featured: true` in their front matter, shown first on the home page.
  eleventyConfig.addFilter('featured', (items) => items.filter((item) => item.data.featured === true))
  eleventyConfig.addFilter('withTag', (items, tag) =>
    items.filter((item) => (item.data.tags || []).some((t) => tagId(t) === tagId(tag))))
  // One entry per tag, however it was written ("Greek" and "greek" are merged).
  eleventyConfig.addFilter('allTags', (items) => {
    const tags = new Map()
    for (const tag of items.flatMap((item) => item.data.tags || [])) {
      if (!tags.has(tagId(tag))) tags.set(tagId(tag), String(tag).toLowerCase())
    }
    return [...tags.values()].sort((a, b) => a.localeCompare(b))
  })

  // JSON that is safe inside a <script> tag
  eleventyConfig.addFilter('jsonScript', (value) => JSON.stringify(value).replace(/</g, '\\u003c'))

  eleventyConfig.addFilter('squash', (html) => String(html).replace(/\s+/g, ' ').trim())
  eleventyConfig.addFilter('plainText', (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  eleventyConfig.addFilter('words', (text, count) => {
    const words = String(text).split(' ')
    return words.length > count ? words.slice(0, count).join(' ') + '...' : text
  })

  return {
    dir: { input: '.', includes: '_includes', layouts: '_layouts', data: '_data', output: '_site' },
    pathPrefix: PATH_PREFIX,
    templateFormats: ['md', 'njk'],
    markdownTemplateEngine: false,
    htmlTemplateEngine: 'njk'
  }
}
