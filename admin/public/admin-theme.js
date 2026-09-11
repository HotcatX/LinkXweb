(function () {
  try {
    var saved = localStorage.getItem('linkx-theme');
    document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
  } catch (_) { document.documentElement.dataset.theme = 'light'; }
})();
