// Reads a photo's pixel size so pages can reserve its space before it loads.
const fs = require('node:fs')

const sizes = new Map()

// JPEG: walk the segments to the frame header (SOF0-SOF15, except DHT/JPG/DAC markers).
function jpegSize (data) {
  let i = 2
  while (i + 9 < data.length) {
    if (data[i] !== 0xFF) return undefined
    const marker = data[i + 1]
    if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) }
    }
    i += 2 + data.readUInt16BE(i + 2)
  }
}

function pngSize (data) {
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

// { width, height } for a .jpeg/.jpg/.png file, or undefined (e.g. SVGs, unknown files).
function imageSize (file) {
  if (!sizes.has(file)) {
    let size
    try {
      const data = fs.readFileSync(file)
      if (data[0] === 0xFF && data[1] === 0xD8) size = jpegSize(data)
      else if (data.toString('ascii', 1, 4) === 'PNG') size = pngSize(data)
    } catch {
      size = undefined
    }
    sizes.set(file, size)
  }
  return sizes.get(file)
}

module.exports = { imageSize }
