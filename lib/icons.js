// The app icon (an open cookbook on terracotta), drawn here and saved as the PNG sizes that
// phones use for the home screen. Made at build time so there are no image files to keep in sync.
const fs = require('node:fs')
const path = require('node:path')

const ACCENT = '#b4532c'
const PAGE = '#fbf8f3'

// `round`: rounded corners (regular icon); without, the color fills the square (Android
// "maskable" icons and iPhones, which round the corners themselves).
function iconSvg ({ round = false, scale = 1 } = {}) {
  const book = `
    <g transform="translate(256 262) scale(${scale}) translate(-256 -262)">
      <path fill="${PAGE}" d="M252 168c-44-30-100-38-148-30v228c48-8 104 0 148 30z"/>
      <path fill="${PAGE}" d="M260 168c44-30 100-38 148-30v228c-48-8-104 0-148 30z"/>
      <g stroke="${ACCENT}" stroke-width="9" stroke-linecap="round" opacity=".45" fill="none">
        <path d="M140 196c30-3 60 2 84 14M140 236c30-3 60 2 84 14M140 276c30-3 60 2 84 14"/>
        <path d="M372 196c-30-3-60 2-84 14M372 236c-30-3-60 2-84 14M372 276c-30-3-60 2-84 14"/>
      </g>
      <path fill="${PAGE}" d="M256 104c-10-16-34-14-34 6 0 16 22 28 34 38 12-10 34-22 34-38 0-20-24-22-34-6z"/>
    </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${round ? 112 : 0}" fill="${ACCENT}"/>${book}
  </svg>`
}

const ICONS = [
  { name: 'icon-192.png', size: 192, round: true },
  { name: 'icon-512.png', size: 512, round: true },
  // Android may crop maskable icons to a circle, so the book is drawn smaller
  { name: 'maskable-512.png', size: 512, scale: 0.8 },
  { name: 'apple-touch-icon.png', size: 180 }
]

async function buildIcons (outDir) {
  const sharp = require('sharp')
  fs.mkdirSync(outDir, { recursive: true })
  for (const icon of ICONS) {
    const file = path.join(outDir, icon.name)
    await sharp(Buffer.from(iconSvg(icon))).resize(icon.size, icon.size).png().toFile(file)
  }
  fs.writeFileSync(path.join(outDir, 'icon.svg'), iconSvg({ round: true }))
}

module.exports = { ICONS, iconSvg, buildIcons }
