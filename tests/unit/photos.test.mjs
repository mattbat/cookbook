import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { variantWidths, variantBase, defaultVariant } = require('../../lib/photos.js')
const { iconSvg, ICONS } = require('../../lib/icons.js')
const { makeWav } = require('../../js/timers.js')

test('big photos get phone, tablet and desktop sizes, capped at 1600 pixels', () => {
  assert.deepEqual(variantWidths(4032), [240, 480, 960, 1600])
  assert.deepEqual(variantWidths(1048), [240, 480, 960, 1048])
})

test('small photos are never made bigger', () => {
  assert.deepEqual(variantWidths(600), [240, 480, 600])
  assert.deepEqual(variantWidths(200), [200])
})

test('copies have web-safe names (srcset breaks on spaces)', () => {
  assert.equal(variantBase('Moroccan Chickpea Soup.jpeg'), 'moroccan-chickpea-soup')
  assert.equal(variantBase("myles's_medium_salsa.jpg"), 'myles-s-medium-salsa')
})

test('the plain src is the biggest copy up to 960 pixels', () => {
  const photo = { variants: [240, 480, 960, 1600].map((width) => ({ width })) }
  assert.equal(defaultVariant(photo).width, 960)
  assert.equal(defaultVariant({ variants: [{ width: 200 }] }).width, 200)
})

test('the app icon comes in the sizes phones ask for', () => {
  assert.deepEqual(ICONS.map((icon) => icon.size).sort((a, b) => a - b), [180, 192, 512, 512])
  assert.match(iconSvg({ round: true }), /^<svg[\s\S]*rx="112"[\s\S]*<\/svg>$/)
  // Maskable and iPhone icons fill the square (the phone rounds the corners)
  assert.match(iconSvg(), /rx="0"/)
})

test('the timer alarm is a valid WAV sound', () => {
  const buffer = makeWav([[880, 0.2], [0, 0.1], [880, 0.2]], 0.8)
  const view = new DataView(buffer)
  const text = (at, length) => String.fromCharCode(...new Uint8Array(buffer, at, length))
  assert.equal(text(0, 4), 'RIFF')
  assert.equal(text(8, 4), 'WAVE')
  assert.equal(view.getUint16(22, true), 1, 'mono')
  assert.equal(view.getUint32(24, true), 22050, 'sample rate')
  const samples = view.getUint32(40, true) / 2
  assert.equal(samples, Math.round(0.2 * 22050) * 2 + Math.round(0.1 * 22050))
  assert.equal(buffer.byteLength, 44 + samples * 2)
  // Loud during the tones, silent in the gap
  let loudest = 0
  for (let i = 0; i < 2000; i++) loudest = Math.max(loudest, Math.abs(view.getInt16(44 + 1000 * 2 + i * 2, true)))
  assert.ok(loudest > 20000)
  const gap = 44 + (Math.round(0.2 * 22050) + 500) * 2
  assert.equal(view.getInt16(gap, true), 0)
})
