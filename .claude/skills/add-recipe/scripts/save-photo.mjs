#!/usr/bin/env node
// Saves a recipe's photo as img/<slug>.jpeg, upright and at most 2000 pixels on its longest side
// (the site build makes the smaller copies phones download).
//
//   node .claude/skills/add-recipe/scripts/save-photo.mjs <photo file or https:// link> <slug>
//   node .claude/skills/add-recipe/scripts/save-photo.mjs --placeholder <slug>
//
// --placeholder makes a plain cookbook-colored image with the app's book on it, for a recipe that
// has no photo yet (every recipe needs one). Replace img/<slug>.jpeg with a real photo any time.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const MAX_SIDE = 2000

export function validSlug (slug) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '')
}

async function readSource (source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { headers: { 'user-agent': BROWSER, accept: 'image/*' }, redirect: 'follow' })
    if (!response.ok) throw new Error(`couldn't download ${source}: HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  if (!fs.existsSync(source)) throw new Error(`no file at ${source}`)
  return fs.readFileSync(source)
}

// A JPEG buffer of the photo, turned upright, resized and without location/camera details
export async function preparePhoto (input) {
  const sharp = require('sharp')
  let meta
  try {
    meta = await sharp(input).metadata()
  } catch (error) {
    throw new Error("that isn't a photo the cookbook can use (try a JPEG, PNG, WebP or HEIC)")
  }
  if (!meta.width || !meta.height) throw new Error('the photo has no size')
  return sharp(input)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()
}

export async function placeholderPhoto () {
  const sharp = require('sharp')
  const { iconSvg } = require(path.join(root, 'lib', 'icons.js'))
  const book = await sharp(Buffer.from(iconSvg({ round: true }))).resize(360, 360).png().toBuffer()
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: '#f2eadf' } })
    .composite([{ input: book, gravity: 'center' }])
    .jpeg({ quality: 85 })
    .toBuffer()
}

async function main (args) {
  const placeholder = args[0] === '--placeholder'
  const [source, slug] = placeholder ? [null, args[1]] : args
  if (!validSlug(slug) || (!placeholder && !source)) {
    console.error('Usage: save-photo.mjs <photo file or link> <slug>   or   save-photo.mjs --placeholder <slug>')
    console.error('The slug is the recipe file name without .md, like "grandmas-pot-roast".')
    process.exit(2)
  }
  const out = path.join(root, 'img', `${slug}.jpeg`)
  const jpeg = placeholder ? await placeholderPhoto() : await preparePhoto(await readSource(source))
  fs.writeFileSync(out, jpeg)
  const sharp = require('sharp')
  const { width, height } = await sharp(jpeg).metadata()
  console.log(JSON.stringify({ saved: path.relative(root, out).split(path.sep).join('/'), width, height, kb: Math.round(jpeg.length / 1024), placeholder }))
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Couldn't save the photo: ${error.message}`)
    process.exitCode = 1
  })
}
