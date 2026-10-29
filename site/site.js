// Shared by every site page.

// "Back to app": the app opens the site with ?from=app. Remember the app page for the rest of the
// visit, so the link shows on every page, not just the first one.
(function () {
  var KEY = 'task4ceApp'
  try {
    if (new URLSearchParams(location.search).get('from') === 'app') {
      var ref = document.referrer
      sessionStorage.setItem(KEY, ref && new URL(ref).origin !== location.origin ? ref : 'back')
    }
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () {
    var link = document.getElementById('back-to-app')
    var app = null
    try { app = sessionStorage.getItem(KEY) } catch (e) {}
    if (!link || !app) return
    link.hidden = false
    if (app !== 'back') link.href = app
    else link.addEventListener('click', function (e) { e.preventDefault(); history.back() })
  })
})()

// Copy buttons on code blocks
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(function () {
    var original = btn.textContent
    btn.textContent = '✓ Copied'
    btn.classList.add('copied')
    setTimeout(function () {
      btn.textContent = original
      btn.classList.remove('copied')
    }, 2000)
  })
}
