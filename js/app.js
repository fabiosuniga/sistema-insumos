function showScreen(screenId) {
  // Oculta todas as seções de telas
  const screens = document.querySelectorAll('.app-screen');
  screens.forEach(s => s.style.display = 'none');

  // Exibe a tela selecionada
  const target = document.getElementById(screenId);
  if (target) {
    target.style.display = 'block';
  }

  // Atualiza botões de abas do protótipo
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeTab = document.getElementById('tab-' + screenId.replace('screen-', ''));
  if (activeTab) activeTab.classList.add('active');

  // Atualiza active do sidebar
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const activeNav = document.getElementById('nav-' + screenId.replace('screen-', ''));
  if (activeNav) activeNav.classList.add('active');
}
