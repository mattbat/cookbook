// The search script uses simple jekyll search by Christian Fei: https://github.com/christian-fei/Simple-Jekyll-Search

// Only ever load one of the two search optios, due to
// SimpleJekyllSearch not supporting instancing being bugged

var jsonUrl = document.body.dataset.base + 'list.json'

var homeSearchInput = document.getElementById('home-search-input')
var navSearchContainer = document.getElementById('nav-search')
if (homeSearchInput) {
  // Big search field on home page
  var homeSearch = SimpleJekyllSearch({
    searchInput: homeSearchInput,
    resultsContainer: document.getElementById('home-search-results-container'),
    json: jsonUrl,
    searchResultTemplate: '{list_entry_html}'
  })

  // Hide small nav search field
  if (navSearchContainer) {
    navSearchContainer.remove()
  }
} else if (navSearchContainer) {
  // Search field in nav-bar
  var navSearch = SimpleJekyllSearch({
    searchInput: document.getElementById('search-input'),
    resultsContainer: document.getElementById('search-results-container'),
    json: jsonUrl
  })
}
