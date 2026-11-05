// Search page: filters and ranks the recipe cards already on the page.
// Matches titles first, then tags and ingredients, then the steps; forgives small typos
// ("gumbp" finds Gumbo) and partial words ("chick" finds chicken). ?q= and ?tag= in the
// address are kept up to date, so a search can be bookmarked or shared.
(function () {
  var root = document.querySelector('[data-search]')
  if (!root) return

  var input = root.querySelector('input[type="search"]')
  var results = root.querySelector('[data-results]')
  var status = root.querySelector('.search-status')
  var empty = root.querySelector('.search-empty')
  var chips = root.querySelectorAll('.chip[data-tag]')
  var cards = Array.prototype.slice.call(results.querySelectorAll('.card'))
  var byUrl = {}
  cards.forEach(function (card) { byUrl[card.dataset.url] = card })

  var params = new URLSearchParams(location.search)
  var tag = params.get('tag') || ''
  input.value = params.get('q') || ''

  var index = null

  function render () {
    var query = input.value.trim()
    var order = cards

    if (query && index) {
      order = index.search(query).map(function (hit) { return byUrl[hit.id] }).filter(Boolean)
    }

    var shown = order.filter(function (card) {
      return !tag || card.dataset.tags.split(' ').indexOf(tag) !== -1
    })

    cards.forEach(function (card) { card.hidden = true })
    shown.forEach(function (card) {
      card.hidden = false
      results.appendChild(card)
    })

    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', chip.dataset.tag === tag ? 'true' : 'false')
    })
    status.textContent = shown.length === 1 ? '1 recipe' : shown.length + ' recipes'
    empty.hidden = shown.length > 0

    var next = new URLSearchParams()
    if (query) next.set('q', query)
    if (tag) next.set('tag', tag)
    var search = next.toString()
    history.replaceState(null, '', location.pathname + (search ? '?' + search : ''))
  }

  input.addEventListener('input', render)
  root.querySelector('form').addEventListener('submit', function (event) {
    event.preventDefault()
    input.blur()
  })
  chips.forEach(function (chip) {
    chip.addEventListener('click', function (event) {
      event.preventDefault()
      tag = chip.dataset.tag === tag ? '' : chip.dataset.tag
      render()
    })
  })

  fetch(document.body.dataset.base + 'list.json')
    .then(function (response) { return response.json() })
    .then(function (recipes) {
      index = new MiniSearch({
        idField: 'url',
        fields: ['title', 'tags', 'author', 'ingredients', 'text'],
        searchOptions: {
          boost: { title: 5, tags: 3, ingredients: 2, author: 2 },
          prefix: true,
          fuzzy: function (term) { return term.length > 3 ? 0.2 : false },
          combineWith: 'AND'
        }
      })
      index.addAll(recipes)
      root.dataset.ready = ''
      render()
    })

  render()
  // On the Search tab, be ready to type straight away (but not when arriving from a category chip)
  if (!input.value && !tag) input.focus()
})()
