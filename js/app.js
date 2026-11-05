// Small behaviours shared by every page.
(function () {
  // Tap a step to mark where you are; tap it again to clear.
  document.addEventListener('click', function (event) {
    var step = event.target.closest('.recipe-method ol > li')
    if (!step || event.target.closest('a')) return
    var wasActive = step.classList.contains('active-step')
    document.querySelectorAll('.active-step').forEach(function (el) { el.classList.remove('active-step') })
    if (!wasActive) step.classList.add('active-step')
  })
})()
