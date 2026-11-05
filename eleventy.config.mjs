import path from 'node:path'
import recipes from './lib/recipes.js'
import images from './lib/images.js'

const { PATH_PREFIX, createMarkdown, stripTitle, absolutizeImages, tagId } = recipes

const { imageSize } = images

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
