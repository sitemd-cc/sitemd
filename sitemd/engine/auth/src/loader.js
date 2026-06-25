// ---------------------------------------------------------------------------
// Dynamic script loader
// ---------------------------------------------------------------------------
export function loadScript(url) {
  return new Promise(function(resolve, reject) {
    const s = document.createElement('script');
    s.src = url; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
