// Ko'rinishni sahifa chizilishidan oldin qo'llash (src/lib/theme.js bilan bir xil kalit)
(function () {
  try {
    var pref = localStorage.getItem('usta24_theme');
    var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#131c2e');
    }
  } catch (e) {}
})();
