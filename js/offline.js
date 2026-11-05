// Offline page: lists the recipes this device has saved, so you can still get to them.
(function () {
  var list = document.querySelector('[data-saved]')
  var none = document.querySelector('.offline-none')
  if (!list) return
  if (!('caches' in window)) {
    none.hidden = false
    return
  }
  var recipePath = new RegExp('^' + document.body.dataset.base + 'recipes/[^/]+/$')

  caches.open('cookbook-pages')
    .then(function (cache) {
      return cache.keys().then(function (requests) {
        var pages = requests.filter(function (request) { return recipePath.test(new URL(request.url).pathname) })
        return Promise.all(pages.map(function (request) {
          return cache.match(request)
            .then(function (response) { return response.text() })
            .then(function (html) {
              var doc = new DOMParser().parseFromString(html, 'text/html')
              var title = doc.querySelector('h1')
              return { url: new URL(request.url).pathname, title: title ? title.textContent.trim() : request.url }
            })
        }))
      })
    })
    .then(function (recipes) {
      recipes.sort(function (a, b) { return a.title.localeCompare(b.title) })
      recipes.forEach(function (recipe) {
        var li = document.createElement('li')
        var a = document.createElement('a')
        a.href = recipe.url
        var span = document.createElement('span')
        span.className = 'index-title'
        span.textContent = recipe.title
        a.appendChild(span)
        li.appendChild(a)
        list.appendChild(li)
      })
      none.hidden = recipes.length > 0
    })
    .catch(function () { none.hidden = false })
})()
