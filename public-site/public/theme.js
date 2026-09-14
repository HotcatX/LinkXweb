try {
  const saved = localStorage.getItem('linkx-public-theme');
  document.documentElement.dataset.theme = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
} catch (_) { document.documentElement.dataset.theme = 'light'; }
