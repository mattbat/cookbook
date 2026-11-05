// The app icon (a "B" monogram on cream), drawn here and saved as the PNG sizes that
// phones use for the home screen. Made at build time so there are no image files to keep in sync.
const fs = require('node:fs')
const path = require('node:path')

// The cream monogram: an italic "B" for Batchelder in a sage ring, with a small crossed
// spoon and fork underneath (option 5c of the logo rounds saved in design/logo-options/).
const PAPER = '#f4efe1'
const SAGE = '#6b8f71'
const INK = '#4f6f55'
const WOOD = '#b07c4f'
// How much of the square the ring fills. Apple's newer icons (Safari, Clock) let a round
// mark take up most of the tile, so the ring spans about 80% of it, not the 64% it was drawn at.
const FILL = 1.22

// The "B" from Playfair Display Bold Italic (SIL Open Font License), traced into a path so it
// looks the same everywhere, including the PNGs, without loading the font. Font units, y up.
const B_PATH = 'M441 707Q557 707 609 671Q661 635 661 575Q661 523 627.5 479.5Q594 436 533.5 408Q473 380 392 372Q505 367 561 323.5Q617 280 617 216Q617 164 592.5 123.5Q568 83 523.5 55.5Q479 28 419 14Q359 0 288 0Q257 0 216.5 1.5Q176 3 113 3Q88 3 59 2.5Q30 2 3 1.5Q-24 1 -42 0L-38 20Q-4 22 15 28Q34 34 45 52Q56 70 65 106L197 602Q205 633 205.5 651.5Q206 670 191.5 678.5Q177 687 138 688L143 708Q161 707 187.5 706.5Q214 706 242.5 705.5Q271 705 295 705Q341 705 374 706Q407 707 441 707ZM255 359 259 376H330Q387 376 425.5 407Q464 438 484 487.5Q504 537 504 591Q504 635 487.5 661.5Q471 688 427 688Q397 688 383.5 674Q370 660 359 617L224 106Q218 84 216 65Q214 46 224 34.5Q234 23 264 23Q325 23 366 52Q407 81 428.5 129Q450 177 450 234Q450 270 439 298Q428 326 402.5 342.5Q377 359 335 359Z'

const FORK = `<g transform="rotate(24 256 270)" fill="${SAGE}">
      <rect x="214" y="96" width="14" height="78" rx="7"/><rect x="238" y="96" width="14" height="78" rx="7"/>
      <rect x="260" y="96" width="14" height="78" rx="7"/><rect x="284" y="96" width="14" height="78" rx="7"/>
      <path d="M214 160h84v14c0 30-20 46-30 52v196a12 12 0 0 1-24 0V226c-10-6-30-22-30-52z"/></g>`
const SPOON = `<g transform="rotate(-24 256 270)" fill="${WOOD}">
      <ellipse cx="256" cy="160" rx="48" ry="66"/><path d="M244 214h24v208a12 12 0 0 1-24 0z"/></g>`

// `round`: rounded corners (regular icon); without, the color fills the square (Android
// "maskable" icons and iPhones, which round the corners themselves).
function iconSvg ({ round = false, scale = 1 } = {}) {
  const mark = `
    <g transform="translate(256 256) scale(${scale * FILL}) translate(-256 -256)">
      <circle cx="256" cy="256" r="164" fill="none" stroke="${SAGE}" stroke-width="8"/>
      <circle cx="256" cy="256" r="146" fill="none" stroke="${SAGE}" stroke-width="2.5" opacity=".6"/>
      <path fill="${INK}" transform="translate(188.1 314) scale(.2 -.2)" d="${B_PATH}"/>
      <g transform="translate(256 372) scale(.17) translate(-256 -270)">${FORK}${SPOON}</g>
    </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${round ? 112 : 0}" fill="${PAPER}"/>${mark}
  </svg>`
}

const ICONS = [
  { name: 'icon-192.png', size: 192, round: true },
  { name: 'icon-512.png', size: 512, round: true },
  // Android may crop maskable icons to a circle (80% of the width), so the ring is drawn to fit inside it
  { name: 'maskable-512.png', size: 512, scale: 0.96 },
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
