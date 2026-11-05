// Makes smaller copies of every recipe photo (the originals straight off a phone are up to 4 MB),
// so phones download a photo about the size of their screen instead of the full original.
// Copies are kept in .cache/photos between builds and only remade when a photo changes.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const WIDTHS = [240, 480, 960, 1600]
const QUALITY = 72
const PHOTO = /\.(jpe?g|png)$/i

// "Moroccan Chickpea Soup.jpeg" -> "moroccan-chickpea-soup" (no spaces, which would break srcset)
function variantBase (file) {
  return path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Which widths to make for a photo `width` pixels wide: the standard ones smaller than it, plus
// one at its full width (up to the largest standard width) for sharp, wide screens.
function variantWidths (width) {
  const largest = WIDTHS[WIDTHS.length - 1]
  const full = Math.min(width, largest)
  return WIDTHS.filter((w) => w < full).concat(full)
}

// Builds (or reuses) the copies. Returns a Map from "/img/<file>" to
// { width, height, variants: [{ width, height, file, name }] } with sizes as the photo is shown
// (phones store some photos sideways with a "rotate me" flag; the copies are turned upright).
async function buildPhotos ({ srcDir, cacheDir }) {
  const sharp = require('sharp')
  fs.mkdirSync(cacheDir, { recursive: true })
  const photos = new Map()
  const files = fs.readdirSync(srcDir).filter((name) => PHOTO.test(name)).sort()
  for (const name of files) {
    const file = path.join(srcDir, name)
    // Named by the photo's contents, so a changed photo gets new copies (and a fresh checkout,
    // as on GitHub, can reuse the saved ones)
    const key = crypto.createHash('sha1').update(fs.readFileSync(file)).update(`:${QUALITY}`).digest('hex').slice(0, 8)
    const meta = await sharp(file).metadata()
    const sideways = (meta.orientation || 1) >= 5
    const width = sideways ? meta.height : meta.width
    const height = sideways ? meta.width : meta.height
    const base = variantBase(name)
    const variants = []
    for (const w of variantWidths(width)) {
      const outName = `${base}-${w}.jpg`
      const cached = path.join(cacheDir, `${base}-${w}-${key}.jpg`)
      if (!fs.existsSync(cached)) {
        await sharp(file)
          .rotate()
          .resize({ width: w, withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
          .toFile(cached + '.tmp')
        fs.renameSync(cached + '.tmp', cached)
      }
      variants.push({ width: w, height: Math.round(height * w / width), file: cached, name: outName })
    }
    photos.set('/img/' + name, { width, height, variants })
  }
  // Remove copies of photos that have since changed or been deleted
  const used = new Set([...photos.values()].flatMap((photo) => photo.variants.map((v) => path.basename(v.file))))
  for (const name of fs.readdirSync(cacheDir)) {
    if (!used.has(name)) fs.rmSync(path.join(cacheDir, name), { force: true })
  }
  return photos
}

// Copies the photos' copies into the built site as img/w/<name>-<width>.jpg
function copyPhotos (photos, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const photo of photos.values()) {
    for (const variant of photo.variants) {
      fs.copyFileSync(variant.file, path.join(outDir, variant.name))
    }
  }
}

// The copy to use as a plain src: the largest one up to 960 pixels wide.
function defaultVariant (photo) {
  const fits = photo.variants.filter((v) => v.width <= 960)
  return fits.length ? fits[fits.length - 1] : photo.variants[0]
}

module.exports = { WIDTHS, buildPhotos, copyPhotos, defaultVariant, variantBase, variantWidths }
