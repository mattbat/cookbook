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
})()
