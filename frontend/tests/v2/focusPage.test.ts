import { focusPage } from '@/v2/kid/focusPage'

test('focuses the first match and makes it focusable; prefers earlier selectors', () => {
  document.body.innerHTML = '<main><h1 class="r-head">Hi</h1></main>'
  focusPage('.r-head', 'main')
  expect(document.activeElement).toBe(document.querySelector('.r-head'))
  expect(document.querySelector('.r-head')?.getAttribute('tabindex')).toBe('-1')
  document.body.innerHTML = '<main>x</main>'
  focusPage('.r-head', 'main')
  expect(document.activeElement).toBe(document.querySelector('main'))
})
