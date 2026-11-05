import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { findDurations, formatTimer, speakTimer } = require('../../js/timers.js')

const seconds = (text) => findDurations(text).map((hit) => hit.seconds)
const texts = (text) => findDurations(text).map((hit) => hit.text)

test('finds minutes, hours and seconds in a step', () => {
  assert.deepEqual(seconds('Microwave on HIGH for 6 minutes. Stir.'), [360])
  assert.deepEqual(seconds('Smoke for 2 hours'), [7200])
  assert.deepEqual(seconds('cook in increments of 30 seconds'), [30])
  assert.deepEqual(seconds('Rest 45 mins, then 1 hr more'), [2700, 3600])
  assert.deepEqual(seconds('Bake 8 Minutes'), [480])
})

test('a range starts the timer at the shorter time, so you can check early', () => {
  assert.deepEqual(seconds('simmer (30-40 minutes depending on size)'), [1800])
  assert.deepEqual(seconds('5 to 10 minutes'), [300])
  assert.deepEqual(seconds('3 or 4 hours'), [10800])
  assert.deepEqual(seconds('25–30 minutes'), [1500])
  assert.deepEqual(texts('simmer (30-40 minutes depending'), ['30-40 minutes'])
})

test('reads fractions, decimals and hours-plus-minutes', () => {
  assert.deepEqual(seconds('2.5 hours'), [9000])
  assert.deepEqual(seconds('1 1/2 hours'), [5400])
  assert.deepEqual(seconds('½ hour'), [1800])
  assert.deepEqual(seconds('1 hour 30 minutes'), [5400])
  assert.deepEqual(seconds('1 hour and 15 minutes'), [4500])
})

test('two times in one sentence are two timers', () => {
  assert.deepEqual(texts('30 seconds to 2 minutes more'), ['30 seconds', '2 minutes'])
})

test('leaves amounts and long waits alone', () => {
  assert.deepEqual(seconds('Add 3-3/4 cups of roux and 2 teaspoons salt'), [])
  assert.deepEqual(seconds('Preheat to 350 degrees'), [])
  assert.deepEqual(seconds('Marinate 24 hours'), [])
  assert.deepEqual(seconds('Cook 242 to 3 hours'), [])
  assert.deepEqual(seconds('Bake for minutes'), [])
})

test('counts down as m:ss, or h:mm:ss past an hour', () => {
  assert.equal(formatTimer(360), '6:00')
  assert.equal(formatTimer(75), '1:15')
  assert.equal(formatTimer(5.2), '0:06')
  assert.equal(formatTimer(3725), '1:02:05')
  assert.equal(formatTimer(-3), '0:00')
})

test('describes a timer in words for screen readers', () => {
  assert.equal(speakTimer(360), '6 minutes')
  assert.equal(speakTimer(90), '1 minute 30 seconds')
  assert.equal(speakTimer(5400), '1 hour 30 minutes')
})
