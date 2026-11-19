/*!
 * CalaStudio website widget (spec 09 §9.3).
 *
 * Inline schedule:
 *   <script src="https://calastudio.app/widget.js" data-studio="sundance-yoga" async></script>
 *
 * Popup (floating "Book a class" button, plus any element with data-calastudio-open):
 *   <script src="https://calastudio.app/widget.js" data-studio="sundance-yoga" data-mode="popup" async></script>
 *   <a href="#" data-calastudio-open>Book now</a>
 *
 * Attributes: data-studio (required), data-mode="inline|popup", data-color="#rrggbb",
 *   data-target="#css-selector" (inline: render into this element instead of after the script),
 *   data-button="Button text" | "false" (popup: floating button text, or none),
 *   data-view, data-locale (reserved).
 * API: window.CalaStudio.open(), window.CalaStudio.close()
 * Events on window: calastudio:booking_started, calastudio:booking_completed,
 *   calastudio:waitlist_joined — event.detail = { studio, occurrence_id, session_name, starts_at }
 *
 * The schedule renders in an iframe served from CalaStudio (app/embed/[studioSlug]), so the host
 * site's CSS can't touch it and booking, sign-in and payment all happen without leaving the page.
 */
(function () {
  'use strict'

  var script = document.currentScript
  if (!script) {
    var all = document.querySelectorAll('script[data-studio]')
    script = all[all.length - 1]
  }
  if (!script || !script.getAttribute('data-studio')) {
    if (window.console) console.warn('[CalaStudio] widget.js needs a data-studio attribute.')
    return
  }

  var origin = new URL(script.src, window.location.href).origin
  var studio = script.getAttribute('data-studio').trim().toLowerCase()
  var mode = script.getAttribute('data-mode') === 'popup' ? 'popup' : 'inline'
  var color = script.getAttribute('data-color') || ''
  var view = script.getAttribute('data-view') || ''
  var locale = script.getAttribute('data-locale') || ''
  var Z = 2147483000
  var BASE = 'display:block;width:100%;border:0;background:transparent;color-scheme:normal;'

  function src(popup) {
    var q = []
    if (/^#[0-9a-fA-F]{6}$/.test(color)) q.push('color=' + encodeURIComponent(color))
    if (view) q.push('view=' + encodeURIComponent(view))
    if (locale) q.push('locale=' + encodeURIComponent(locale))
    if (popup) q.push('popup=1')
    return origin + '/embed/' + encodeURIComponent(studio) + (q.length ? '?' + q.join('&') : '')
  }

  function makeFrame(popup) {
    var f = document.createElement('iframe')
    f.src = src(popup)
    f.title = 'Class schedule and booking'
    // payment: Apple Pay / Google Pay inside Stripe's payment form.
    f.setAttribute('allow', 'payment *')
    f.style.cssText = BASE
    return f
  }

  // Page scroll lock while the widget is full-screen.
  var savedOverflow = null
  function lockScroll(lock) {
    var html = document.documentElement
    if (lock && savedOverflow === null) { savedOverflow = html.style.overflow; html.style.overflow = 'hidden' }
    if (!lock && savedOverflow !== null) { html.style.overflow = savedOverflow; savedOverflow = null }
  }
  var FULL = 'position:fixed;top:0;left:0;width:100%;height:100%;max-width:none;margin:0;z-index:' + Z + ';'

  function emit(name, detail) {
    var d = { studio: studio }
    if (detail) for (var k in detail) if (Object.prototype.hasOwnProperty.call(detail, k)) d[k] = detail[k]
    var ev
    try { ev = new CustomEvent('calastudio:' + name, { detail: d }) }
    catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('calastudio:' + name, false, false, d) }
    window.dispatchEvent(ev)
  }

  var frame, wrapper, height = 600, overlayOpen = false, popupOpen = false

  if (mode === 'inline') {
    wrapper = document.createElement('div')
    wrapper.className = 'calastudio-widget'
    wrapper.style.cssText = 'position:relative;width:100%;'
    frame = makeFrame(false)
    frame.style.height = height + 'px'
    wrapper.appendChild(frame)
    var target = script.getAttribute('data-target') && document.querySelector(script.getAttribute('data-target'))
    if (target) target.appendChild(wrapper)
    else script.parentNode.insertBefore(wrapper, script.nextSibling)
  }

  function setOverlay(open) {
    if (mode !== 'inline' || open === overlayOpen) return
    overlayOpen = open
    if (open) {
      // Hold the widget's place in the page so nothing jumps while the frame goes full-screen.
      wrapper.style.height = height + 'px'
      frame.style.cssText += FULL
    } else {
      frame.style.cssText = BASE + 'height:' + height + 'px;'
      wrapper.style.height = ''
    }
    lockScroll(open)
  }

  function ensurePopup() {
    if (frame) return
    frame = makeFrame(true)
    frame.style.cssText += FULL + 'display:none;'
    document.body.appendChild(frame)
  }
  function open() {
    if (mode !== 'popup') { if (wrapper) wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    ensurePopup()
    frame.style.display = 'block'
    popupOpen = true
    lockScroll(true)
    try { frame.focus() } catch (e) { /* ignore */ }
  }
  function close() {
    if (mode !== 'popup' || !popupOpen) return
    frame.style.display = 'none'
    popupOpen = false
    lockScroll(false)
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !frame || e.source !== frame.contentWindow) return
    var d = e.data
    if (!d || d.source !== 'calastudio') return
    if (d.type === 'resize' && typeof d.height === 'number' && d.height > 0) {
      height = Math.ceil(d.height)
      if (mode === 'inline' && !overlayOpen) frame.style.height = height + 'px'
    } else if (d.type === 'overlay') {
      setOverlay(!!d.open)
    } else if (d.type === 'close') {
      close()
    } else if (d.type === 'event' && typeof d.name === 'string') {
      emit(d.name, d.detail)
    }
  })

  if (mode === 'popup') {
    var label = script.getAttribute('data-button')
    if (label !== 'false') {
      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'calastudio-book-button'
      btn.textContent = label || 'Book a class'
      btn.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:' + (Z - 1) + ';border:0;border-radius:999px;' +
        'padding:14px 22px;font:600 15px/1 system-ui,-apple-system,sans-serif;color:#fff;cursor:pointer;' +
        'box-shadow:0 6px 20px rgba(0,0,0,.25);background:' + (/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#085041') + ';'
      btn.addEventListener('click', open)
      var addBtn = function () { document.body.appendChild(btn) }
      if (document.body) addBtn(); else document.addEventListener('DOMContentLoaded', addBtn)
    }
    // Any element on the page can open it.
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-calastudio-open]')
      if (!el) return
      var want = el.getAttribute('data-calastudio-open')
      if (want && want.toLowerCase() !== studio) return
      e.preventDefault()
      open()
    })
    // Warm the popup up once the page is idle, so it opens instantly.
    var warm = function () { if (document.body) ensurePopup() }
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 3000 })
    else setTimeout(warm, 1500)
  }

  window.CalaStudio = window.CalaStudio || {}
  window.CalaStudio.open = open
  window.CalaStudio.close = close
})()
