import recipes from './lib/recipes.js'

const { PATH_PREFIX, createMarkdown, stripTitle, absolutizeImages, tagId } = recipes

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
