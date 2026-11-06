#!/usr/bin/env node
// Prints what a new recipe should fit in with, as JSON: today's date, the tags in use (and how
// often), the family authors, and the recipes already in the cookbook (to avoid duplicates).
//
//   node .claude/skills/add-recipe/scripts/cookbook-context.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

// The allowed tags, read from the recipe checks so there's one list to keep up to date
export function knownTags (testSource) {
  const list = testSource.match(/const KNOWN_TAGS = new Set\(\[([\s\S]*?)\]\)/)
  if (!list) return []
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

export function today (date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function cookbookContext (dir = root) {
  const matter = require('gray-matter')
  const recipesDir = path.join(dir, '_recipes')
  const tagCounts = {}
  const authorCounts = {}
  const recipes = []
  for (const file of fs.readdirSync(recipesDir).filter((name) => name.endsWith('.md')).sort()) {
    const { data, content } = matter(fs.readFileSync(path.join(recipesDir, file), 'utf8'))
    const title = (content.match(/^#[ \t]+(.+?)\s*$/m) || [])[1] || file
    recipes.push({ file: `_recipes/${file}`, title })
    for (const tag of data.tags || []) tagCounts[tag] = (tagCounts[tag] || 0) + 1
    if (data.author) authorCounts[data.author] = (authorCounts[data.author] || 0) + 1
  }
  const tags = knownTags(fs.readFileSync(path.join(dir, 'tests/content/recipes.test.mjs'), 'utf8'))
  return {
    today: today(),
    tags: tags.map((tag) => ({ tag, recipes: tagCounts[tag] || 0 })).sort((a, b) => b.recipes - a.recipes),
    authors: Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, recipes: count })),
    recipes
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(JSON.stringify(cookbookContext(), null, 2))
}
