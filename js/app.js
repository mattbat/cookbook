// Small behaviours shared by every page.
window.Cookbook = window.Cookbook || {}

;(function () {
  // Tap a step to mark where you are; tap it again to clear.
  document.addEventListener('click', function (event) {
    var step = event.target.closest('.recipe-method ol > li')
    if (!step || event.target.closest('a, button')) return
    var wasActive = step.classList.contains('active-step')
    document.querySelectorAll('.active-step').forEach(function (el) { el.classList.remove('active-step') })
    if (!wasActive) step.classList.add('active-step')
  })

  // A short message at the bottom of the screen ("Link copied")
  var toast, hideTimer
  Cookbook.toast = function (message) {
    if (!toast) {
      toast = document.createElement('div')
      toast.className = 'toast'
      toast.setAttribute('role', 'status')
      document.body.appendChild(toast)
    }
    // Inside cook mode, the toast has to be in the dialog to be seen
    var dialog = document.querySelector('dialog[open]')
    ;(dialog || document.body).appendChild(toast)
    toast.textContent = message
    toast.classList.add('show')
    clearTimeout(hideTimer)
    hideTimer = setTimeout(function () { toast.classList.remove('show') }, 2500)
  }

  // Copy text, also on pages opened over plain http (like testing on a phone at home),
  // where the clipboard API isn't available.
  Cookbook.copyText = function (text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      var ok = false
      try { ok = document.execCommand('copy') } catch (e) {}
      area.remove()
      ok ? resolve() : reject(new Error('copy failed'))
    })
  }

  // The heading a list of steps sits under ("Steps (Day 2)", "Strawberry Topping")
  Cookbook.sectionName = function (list) {
    for (var el = list.previousElementSibling; el; el = el.previousElementSibling) {
      if (/^H[2-4]$/.test(el.tagName)) return el.textContent.trim()
    }
    return list.dataset.section || ''
  }

  // --- Installed app ---

  var base = document.body.dataset.base || '/'
  var installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

  // Save the site on the phone for offline use (needs https; also works on localhost)
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(base + 'sw.js', { scope: base }).catch(function () {})
    })
  }

  // The app's own Back button: go back if we came from inside the cookbook, otherwise home
  var back = document.querySelector('.topbar .back')
  if (back) {
    back.addEventListener('click', function (event) {
      if (history.length > 1 && document.referrer.indexOf(location.origin + base) === 0) {
        event.preventDefault()
        history.back()
      }
    })
  }

  Cookbook.storage = {
    get: function (key, fallback) {
      try {
        var value = localStorage.getItem(key)
        return value === null ? fallback : JSON.parse(value)
      } catch (e) { return fallback }
    },
    set: function (key, value) {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, JSON.stringify(value))
      } catch (e) {}
    }
  }

  // "Put the cookbook on your home screen" on the home page, until it's installed or dismissed.
  // Android/desktop Chrome offer an Install button; on an iPhone it's Share > Add to Home Screen.
  var banner = document.querySelector('.install')
  var DISMISSED = 'cookbook-install-dismissed'
  if (banner && !installed && !Cookbook.storage.get(DISMISSED, false)) {
    var button = banner.querySelector('.install-button')
    var prompt = null
    var hide = function () { banner.hidden = true }
    var ua = navigator.userAgent
    var iPhone = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    // Only Safari can add to the home screen on older iPhones; other iPhone browsers have no Share > Add
    var safari = iPhone && !/CriOS|FxiOS|EdgiOS/.test(ua)

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault()
      prompt = event
      button.hidden = false
      banner.hidden = false
    })
    button.addEventListener('click', function () {
      if (!prompt) return
      prompt.prompt()
      prompt.userChoice.then(function (choice) {
        if (choice.outcome === 'accepted') hide()
        prompt = null
      })
    })
    window.addEventListener('appinstalled', hide)
    banner.querySelector('.install-close').addEventListener('click', function () {
      Cookbook.storage.set(DISMISSED, true)
      hide()
    })
    if (safari) {
      banner.querySelector('.install-ios').hidden = false
      banner.hidden = false
    }
  }
})()
