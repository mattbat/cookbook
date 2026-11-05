// Recipe page tools for cooking: check off ingredients, copy the list, share the recipe,
// keep the screen on, and cook mode (one big step at a time).
(function () {
  var Cookbook = window.Cookbook
  var title = (document.querySelector('.recipe-intro h1') || {}).textContent || document.title

  // --- Ingredient check-offs (remembered on this device, per recipe) ---
  var checkKey = 'cookbook-checked:' + location.pathname
  var items = Array.prototype.filter.call(
    document.querySelectorAll('.recipe-ingredients li'),
    function (li) { return !li.querySelector('ul, ol') })
  var clearButton = document.querySelector('.clear-checks')
  var checked = Cookbook.storage.get(checkKey, [])
  if (!Array.isArray(checked)) checked = []

  function setChecked (index, on) {
    var li = items[index]
    if (!li) return
    li.classList.toggle('checked', on)
    li.setAttribute('aria-checked', on ? 'true' : 'false')
  }

  function saveChecks () {
    checked = items.reduce(function (list, li, i) {
      if (li.classList.contains('checked')) list.push(i)
      return list
    }, [])
    Cookbook.storage.set(checkKey, checked.length ? checked : null)
    if (clearButton) clearButton.hidden = checked.length === 0
    renderCookIngredients()
  }

  function toggleItem (index) {
    setChecked(index, !items[index].classList.contains('checked'))
    saveChecks()
  }

  items.forEach(function (li, i) {
    li.setAttribute('role', 'checkbox')
    li.setAttribute('tabindex', '0')
    setChecked(i, checked.indexOf(i) !== -1)
    li.addEventListener('click', function (event) {
      if (event.target.closest('a, button')) return
      toggleItem(i)
    })
    li.addEventListener('keydown', function (event) {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        toggleItem(i)
      }
    })
  })
  if (clearButton) {
    clearButton.hidden = checked.length === 0
    clearButton.addEventListener('click', function () {
      items.forEach(function (li, i) { setChecked(i, false) })
      saveChecks()
    })
  }

  // --- Copy the ingredient list (at the current serving size) ---
  function ingredientsText () {
    var servings = document.querySelector('input[name="recipe_scaling"]')
    var label = document.querySelector('.recipe-scaling label')
    var lines = [title.trim()]
    if (servings && label) lines.push(label.textContent.trim() + ': ' + servings.value)
    var section = document.querySelector('.recipe-ingredients')
    section.querySelectorAll('h2, h3, h4, li').forEach(function (el) {
      if (el.tagName === 'LI') {
        if (items.indexOf(el) === -1) return
        lines.push('- ' + el.textContent.replace(/\s+/g, ' ').trim())
      } else {
        lines.push('', el.textContent.replace(/\s+/g, ' ').trim())
      }
    })
    lines.push('', location.href.split('#')[0])
    return lines.join('\n')
  }

  var copyButton = document.querySelector('.copy-ingredients')
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      Cookbook.copyText(ingredientsText()).then(
        function () { Cookbook.toast('Ingredients copied') },
        function () { Cookbook.toast('Couldn’t copy the list') })
    })
  }

  // --- Share ---
  var shareButton = document.querySelector('.kitchen-tools .share')
  var canonical = document.querySelector('link[rel="canonical"]')
  var shareUrl = canonical ? canonical.href : location.href.split('#')[0]
  if (shareButton) {
    shareButton.addEventListener('click', function () {
      var data = { title: title.trim(), text: title.trim() + ' from the Batchelder family cookbook', url: shareUrl }
      if (navigator.share) {
        navigator.share(data).catch(function (error) {
          if (error && error.name !== 'AbortError') copyLink()
        })
      } else {
        copyLink()
      }
    })
  }
  function copyLink () {
    Cookbook.copyText(shareUrl).then(
      function () { Cookbook.toast('Link copied') },
      function () { Cookbook.toast(shareUrl) })
  }

  // --- Keep the screen on (where the browser supports it; needs https) ---
  var awakeButton = document.querySelector('.keep-awake')
  var wakeLock = null
  var wantAwake = false
  var supportsWakeLock = 'wakeLock' in navigator

  function renderAwake () {
    if (!awakeButton) return
    awakeButton.setAttribute('aria-pressed', wantAwake ? 'true' : 'false')
    var cookToggle = dialog && dialog.querySelector('.cook-awake')
    if (cookToggle) cookToggle.setAttribute('aria-pressed', wantAwake ? 'true' : 'false')
  }

  function requestWakeLock (loud) {
    if (!supportsWakeLock || wakeLock || document.visibilityState !== 'visible') return
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock
      lock.addEventListener('release', function () { wakeLock = null })
      if (!wantAwake) lock.release()
    }, function () {
      wantAwake = false
      renderAwake()
      if (loud) Cookbook.toast('Couldn’t keep the screen on')
    })
  }

  // `loud`: say so if it doesn't work (only when you pressed the button yourself)
  function setAwake (on, loud) {
    wantAwake = on
    if (on) requestWakeLock(loud)
    else if (wakeLock) wakeLock.release()
    renderAwake()
  }

  if (awakeButton && supportsWakeLock) {
    awakeButton.hidden = false
    awakeButton.addEventListener('click', function () {
      setAwake(!wantAwake, true)
      if (wantAwake) Cookbook.toast('Screen will stay on while this page is open')
    })
  }
  // The screen lock is dropped when you switch apps; take it back when you return
  document.addEventListener('visibilitychange', function () {
    if (wantAwake) requestWakeLock()
  })

  // --- Cook mode: one step at a time, big text, swipe or tap to move ---
  var steps = Array.prototype.slice.call(document.querySelectorAll('ol.steps > li'))
  var startButton = document.querySelector('.cook-start')
  var dialog = null
  var current = 0
  var awakeBeforeCooking = false

  function build () {
    dialog = document.createElement('dialog')
    dialog.className = 'cook'
    dialog.setAttribute('aria-label', 'Cook mode: ' + title.trim())
    dialog.innerHTML =
      '<div class="cook-bar">' +
        '<div class="cook-heading"><p class="cook-title"></p><p class="cook-count" aria-live="polite"></p></div>' +
        (supportsWakeLock ? '<button type="button" class="cook-awake" aria-pressed="false" aria-label="Keep screen on" title="Keep screen on">' + iconSun() + '</button>' : '') +
        '<button type="button" class="cook-close" aria-label="Close cook mode">&times;</button>' +
      '</div>' +
      '<div class="cook-progress" aria-hidden="true"><span></span></div>' +
      '<div class="cook-stage">' +
        '<p class="cook-section"></p>' +
        '<div class="cook-step"></div>' +
      '</div>' +
      '<details class="cook-ingredients"><summary>Ingredients</summary><ul></ul></details>' +
      '<div class="cook-nav">' +
        '<button type="button" class="cook-prev">Back</button>' +
        '<button type="button" class="cook-next">Next</button>' +
      '</div>'
    dialog.querySelector('.cook-title').textContent = title.trim()
    document.body.appendChild(dialog)

    dialog.querySelector('.cook-close').addEventListener('click', function () { dialog.close() })
    dialog.querySelector('.cook-prev').addEventListener('click', function () { go(current - 1) })
    dialog.querySelector('.cook-next').addEventListener('click', function () {
      if (current >= steps.length - 1) dialog.close()
      else go(current + 1)
    })
    var awake = dialog.querySelector('.cook-awake')
    if (awake) awake.addEventListener('click', function () { setAwake(!wantAwake, true) })
    dialog.addEventListener('close', finish)
    dialog.addEventListener('keydown', function (event) {
      if (event.target.closest('summary, input')) return
      if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1) }
    })

    // Swipe left for the next step, right for the previous one
    var stage = dialog.querySelector('.cook-stage')
    var startX = null
    var startY = null
    stage.addEventListener('touchstart', function (event) {
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
    }, { passive: true })
    stage.addEventListener('touchend', function (event) {
      if (startX === null) return
      var dx = event.changedTouches[0].clientX - startX
      var dy = event.changedTouches[0].clientY - startY
      startX = null
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1))
    })

    var cookList = dialog.querySelector('.cook-ingredients ul')
    cookList.addEventListener('click', function (event) {
      var li = event.target.closest('li[data-index]')
      if (li && !event.target.closest('a')) toggleItem(Number(li.dataset.index))
    })
    cookList.addEventListener('keydown', function (event) {
      var li = event.target.closest('li[data-index]')
      if (li && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault()
        toggleItem(Number(li.dataset.index))
        var again = cookList.querySelector('li[data-index="' + li.dataset.index + '"]')
        if (again) again.focus()
      }
    })
  }

  function iconSun () {
    var icon = document.querySelector('.keep-awake .icon')
    return icon ? icon.outerHTML : '☀'
  }

  function renderCookIngredients () {
    if (!dialog) return
    var list = dialog.querySelector('.cook-ingredients ul')
    list.innerHTML = ''
    items.forEach(function (li, i) {
      var copy = document.createElement('li')
      copy.dataset.index = i
      copy.setAttribute('role', 'checkbox')
      copy.setAttribute('tabindex', '0')
      copy.setAttribute('aria-checked', li.classList.contains('checked') ? 'true' : 'false')
      copy.className = li.classList.contains('checked') ? 'checked' : ''
      copy.innerHTML = li.innerHTML
      list.appendChild(copy)
    })
  }

  function go (index) {
    current = Math.max(0, Math.min(steps.length - 1, index))
    var step = steps[current]
    var list = step.parentElement
    var lists = document.querySelectorAll('ol.steps')
    var inList = Array.prototype.indexOf.call(list.children, step)
    dialog.querySelector('.cook-count').textContent = 'Step ' + (current + 1) + ' of ' + steps.length
    dialog.querySelector('.cook-section').textContent =
      lists.length > 1 ? Cookbook.sectionName(list) + ' · step ' + (inList + 1) : ''
    dialog.querySelector('.cook-step').innerHTML = step.innerHTML
    dialog.querySelector('.cook-progress span').style.width = ((current + 1) / steps.length * 100) + '%'
    dialog.querySelector('.cook-prev').disabled = current === 0
    dialog.querySelector('.cook-next').textContent = current === steps.length - 1 ? 'Done' : 'Next'
    document.querySelectorAll('.active-step').forEach(function (el) { el.classList.remove('active-step') })
    step.classList.add('active-step')
  }

  function open () {
    if (!dialog) build()
    renderCookIngredients()
    var active = document.querySelector('ol.steps > li.active-step')
    go(active ? steps.indexOf(active) : 0)
    // Timers have to be inside the dialog to show on top of it
    if (Cookbook.timers) dialog.appendChild(Cookbook.timers.tray)
    document.documentElement.classList.add('cooking')
    awakeBeforeCooking = wantAwake
    if (supportsWakeLock) setAwake(true)
    dialog.showModal()
    dialog.querySelector('.cook-next').focus()
  }

  function finish () {
    document.documentElement.classList.remove('cooking')
    if (Cookbook.timers) document.body.appendChild(Cookbook.timers.tray)
    if (supportsWakeLock && !awakeBeforeCooking) setAwake(false)
    // Back on the page, the step you were on stays highlighted
    var step = steps[current]
    if (step) step.scrollIntoView({ block: 'center' })
  }

  if (startButton && steps.length) {
    startButton.addEventListener('click', open)
  } else if (startButton) {
    startButton.hidden = true
  }
})()
