// Kitchen timers. Times written in a recipe's steps ("simmer for 30-40 minutes") become buttons;
// tapping one starts a countdown in a small tray at the bottom of the screen. Timers keep running
// if you go to another page or lock the phone, and beep and buzz when they're done.
// For a range like "30-40 minutes" the timer is set to the shorter time, so you can check early.

var TIMER_UNITS = { s: 1, m: 60, h: 3600 }
var TIMER_FRACTIONS = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3 }
var TIMER_NUMBER = '\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*[½¼¾⅓⅔]|\\d+(?:\\.\\d+)?'
var TIMER_UNIT = '(hours?|hrs?|minutes?|mins?|seconds?|secs?)\\b'
var TIMER_PATTERN = new RegExp(
  '(^|[^\\w./])' +
  '(' + TIMER_NUMBER + ')(?:\\s*(?:-|–|—|to|or)\\s*(?:' + TIMER_NUMBER + '))?\\s*' + TIMER_UNIT +
  '(?:,?\\s*(?:and\\s+)?(' + TIMER_NUMBER + ')\\s*(minutes?|mins?)\\b)?',
  'gi')
// Longer than this is a "marinate overnight" kind of wait, not a timer
var TIMER_MAX_SECONDS = 12 * 3600

function timerNumber (text) {
  text = text.trim()
  var parts = text.split(/\s+/)
  if (parts.length > 1) return parts.reduce(function (sum, part) { return sum + timerNumber(part) }, 0)
  if (text.indexOf('/') > 0) {
    var halves = text.split('/')
    return Number(halves[0]) / Number(halves[1])
  }
  var last = text.slice(-1)
  if (TIMER_FRACTIONS[last] !== undefined) return (Number(text.slice(0, -1)) || 0) + TIMER_FRACTIONS[last]
  return Number(text)
}

// "Bake 25-30 minutes, then rest 5 min" -> [{ index, text: "25-30 minutes", seconds: 1500 }, { ..., seconds: 300 }]
function findDurations (text) {
  var found = []
  var match
  TIMER_PATTERN.lastIndex = 0
  while ((match = TIMER_PATTERN.exec(text))) {
    var unit = TIMER_UNITS[match[3][0].toLowerCase()]
    var seconds = timerNumber(match[2]) * unit
    if (match[4]) seconds += timerNumber(match[4]) * 60
    seconds = Math.round(seconds)
    var start = match.index + match[1].length
    if (seconds > 0 && seconds <= TIMER_MAX_SECONDS) {
      found.push({ index: start, text: match[0].slice(match[1].length), seconds: seconds })
    }
  }
  return found
}

// A WAV sound file made of tones: [[frequency in Hz (0 for silence), seconds], ...]
function makeWav (tones, volume) {
  var rate = 22050
  var total = tones.reduce(function (sum, tone) { return sum + Math.round(tone[1] * rate) }, 0)
  var buffer = new ArrayBuffer(44 + total * 2)
  var view = new DataView(buffer)
  var text = function (offset, value) {
    for (var i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF'); view.setUint32(4, 36 + total * 2, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, total * 2, true)
  var at = 44
  tones.forEach(function (tone) {
    var count = Math.round(tone[1] * rate)
    var fade = Math.min(count / 2, rate * 0.01)
    for (var i = 0; i < count; i++) {
      // Short fades at each end, so the tones don't click
      var envelope = Math.min(1, i / fade, (count - i) / fade)
      var sample = tone[0] ? Math.sin(2 * Math.PI * tone[0] * i / rate) * volume * envelope : 0
      view.setInt16(at, Math.round(sample * 32767), true)
      at += 2
    }
  })
  return buffer
}

// 75 -> "1:15", 3725 -> "1:02:05"
function formatTimer (seconds) {
  seconds = Math.max(0, Math.ceil(seconds))
  var h = Math.floor(seconds / 3600)
  var m = Math.floor((seconds % 3600) / 60)
  var s = seconds % 60
  var pad = function (n) { return (n < 10 ? '0' : '') + n }
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s)
}

// 90 -> "1 minute 30 seconds", for screen readers
function speakTimer (seconds) {
  var h = Math.floor(seconds / 3600)
  var m = Math.floor((seconds % 3600) / 60)
  var s = seconds % 60
  var plural = function (n, word) { return n + ' ' + word + (n === 1 ? '' : 's') }
  return [h && plural(h, 'hour'), m && plural(m, 'minute'), s && plural(s, 'second')].filter(Boolean).join(' ')
}

if (typeof document !== 'undefined') (function () {
  var KEY = 'cookbook-timers'
  var store = window.Cookbook.storage
  var timers = store.get(KEY, [])
  if (!Array.isArray(timers)) timers = []

  var tray = document.createElement('div')
  tray.className = 'timers'
  tray.setAttribute('aria-label', 'Timers')
  tray.setAttribute('role', 'region')
  tray.hidden = true
  document.body.appendChild(tray)
  var rows = {}

  var alarmUntil = 0
  var lastBeep = 0

  function save () { store.set(KEY, timers.length ? timers : null) }

  function remaining (timer) {
    if (timer.left !== undefined && timer.left !== null) return timer.left
    return (timer.end - Date.now()) / 1000
  }

  // Sound. Phones only play sound that a tap started, so the first tap (starting a timer, or any
  // tap once a timer is running) "unlocks" the alarm clip for later. It's an ordinary audio clip
  // rather than generated tones, because iPhones mute generated tones when the silent switch is on.
  var alarm = null
  var blip = null
  var unlocked = false

  function clip (tones, volume) {
    try {
      var url = URL.createObjectURL(new Blob([makeWav(tones, volume)], { type: 'audio/wav' }))
      var el = new Audio(url)
      el.preload = 'auto'
      el.setAttribute('playsinline', '')
      return el
    } catch (e) { return null }
  }

  function unlockSound () {
    // Let a timer sound even when an iPhone's silent switch is on (Safari 17+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch (e) {}
    if (!alarm) alarm = clip([[880, 0.22], [0, 0.1], [880, 0.22], [0, 0.1], [1175, 0.4]], 0.9)
    if (!blip) blip = clip([[1320, 0.07]], 0.35)
    if (unlocked || !alarm) return
    alarm.muted = true
    var played = alarm.play()
    var done = function () {
      alarm.pause()
      alarm.currentTime = 0
      alarm.muted = false
    }
    if (played && played.then) played.then(function () { unlocked = true; done() }, done)
    else { unlocked = true; done() }
  }

  function beep () {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300])
    if (!alarm) return
    try {
      alarm.muted = false
      alarm.currentTime = 0
      var played = alarm.play()
      if (played && played.catch) played.catch(function () {})
    } catch (e) {}
  }

  // A running or finished timer from another page: unlock the sound on the next tap anywhere
  document.addEventListener('pointerdown', function () {
    if (timers.length) unlockSound()
  }, { capture: true, passive: true })

  function row (timer) {
    var el = document.createElement('div')
    el.className = 'timer'
    el.dataset.id = timer.id
    el.innerHTML =
      '<a class="timer-text"><span class="timer-name"></span><span class="timer-time" role="timer"></span></a>' +
      '<button type="button" class="timer-pause"></button>' +
      '<button type="button" class="timer-stop">&times;</button>'
    el.querySelector('.timer-name').textContent = timer.label
    el.querySelector('.timer-text').href = timer.url
    el.querySelector('.timer-pause').addEventListener('click', function () { togglePause(timer.id) })
    el.querySelector('.timer-stop').addEventListener('click', function () { stop(timer.id) })
    return el
  }

  function render () {
    var now = Date.now()
    var ringing = false
    timers.forEach(function (timer) {
      var el = rows[timer.id]
      if (!el) {
        el = rows[timer.id] = row(timer)
        tray.appendChild(el)
      }
      var left = remaining(timer)
      var paused = timer.left !== undefined && timer.left !== null
      if (!timer.done && left <= 0) {
        timer.done = true
        alarmUntil = now + 60 * 1000
        lastBeep = 0
        save()
      }
      if (timer.done) ringing = true
      el.classList.toggle('done', !!timer.done)
      el.classList.toggle('paused', paused)
      el.querySelector('.timer-time').textContent = timer.done ? 'Done!' : formatTimer(left)
      var pause = el.querySelector('.timer-pause')
      pause.hidden = !!timer.done
      pause.textContent = paused ? '▶' : '❚❚'
      pause.setAttribute('aria-label', (paused ? 'Resume ' : 'Pause ') + timer.label + ' timer')
      el.querySelector('.timer-stop').setAttribute('aria-label', (timer.done ? 'Dismiss ' : 'Stop ') + timer.label + ' timer')
    })
    Object.keys(rows).forEach(function (id) {
      if (!timers.some(function (t) { return String(t.id) === id })) {
        rows[id].remove()
        delete rows[id]
      }
    })
    tray.hidden = timers.length === 0
    document.body.classList.toggle('has-timers', timers.length > 0)

    // Keep beeping every few seconds (for up to a minute) until the timer is dismissed
    if (ringing && now < alarmUntil && now - lastBeep > 4000) {
      lastBeep = now
      beep()
    }
  }

  function start (seconds, label) {
    // This runs from a tap, so the sound can be unlocked now; a short blip says sound is on
    unlockSound()
    if (blip) {
      try {
        blip.currentTime = 0
        var played = blip.play()
        if (played && played.catch) played.catch(function () {})
      } catch (e) {}
    }

    var already = timers.some(function (t) { return t.label === label && t.seconds === seconds && !t.done })
    if (already) {
      window.Cookbook.toast('That timer is already running')
      return
    }
    timers.push({
      id: Date.now() + '-' + Math.floor(Math.random() * 1000),
      label: label,
      seconds: seconds,
      end: Date.now() + seconds * 1000,
      url: location.pathname + location.search
    })
    save()
    render()
    window.Cookbook.toast('Timer started: ' + speakTimer(seconds))
  }

  function togglePause (id) {
    timers.forEach(function (timer) {
      if (timer.id !== id || timer.done) return
      if (timer.left !== undefined && timer.left !== null) {
        timer.end = Date.now() + timer.left * 1000
        timer.left = null
      } else {
        timer.left = Math.max(0, (timer.end - Date.now()) / 1000)
      }
    })
    save()
    render()
  }

  function stop (id) {
    timers = timers.filter(function (timer) { return timer.id !== id })
    save()
    render()
  }

  // Turn the times in each step into timer buttons
  var title = document.querySelector('.recipe-intro h1')
  var stepLists = document.querySelectorAll('ol.steps')
  stepLists.forEach(function (list) {
    var steps = Array.prototype.filter.call(list.children, function (el) { return el.tagName === 'LI' })
    steps.forEach(function (step, i) {
      var label = (title ? title.textContent.trim() + ' · ' : '') +
        (stepLists.length > 1 ? window.Cookbook.sectionName(list) + ', step ' : 'Step ') + (i + 1)
      var walker = document.createTreeWalker(step, NodeFilter.SHOW_TEXT)
      var nodes = []
      while (walker.nextNode()) {
        if (!walker.currentNode.parentNode.closest('a, button')) nodes.push(walker.currentNode)
      }
      nodes.forEach(function (node) {
        var found = findDurations(node.nodeValue)
        for (var j = found.length - 1; j >= 0; j--) {
          var hit = found[j]
          var after = node.splitText(hit.index)
          after.nodeValue = after.nodeValue.slice(hit.text.length)
          var button = document.createElement('button')
          button.type = 'button'
          button.className = 'timer-link'
          button.dataset.seconds = hit.seconds
          button.dataset.label = label
          button.textContent = hit.text
          button.setAttribute('aria-label', hit.text + ': start a ' + speakTimer(hit.seconds) + ' timer')
          node.parentNode.insertBefore(button, after)
        }
      })
    })
  })

  // Works for the step buttons and their copies in cook mode
  document.addEventListener('click', function (event) {
    var button = event.target.closest('.timer-link')
    if (!button) return
    start(Number(button.dataset.seconds), button.dataset.label)
  })

  // Timers started in another tab
  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return
    timers = store.get(KEY, [])
    render()
  })

  render()
  setInterval(render, 250)

  window.Cookbook.timers = { tray: tray, start: start }
})()

// Lets the unit tests load this file in Node
if (typeof module !== 'undefined') {
  module.exports = { findDurations, formatTimer, speakTimer, timerNumber, makeWav }
}
