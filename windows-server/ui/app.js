(() => {
  const $ = (id) => document.getElementById(id);
  const api = window.desktop;

  function msg(text, kind) {
    const el = $('msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function paint(status) {
    const running = !!(status && status.running);
    const badge = $('badge');
    badge.textContent = running ? 'працює' : 'вимкнено';
    badge.className = 'badge ' + (running ? 'on' : 'off');
    $('statusText').textContent = running
      ? ('онлайн · ' + (status.host || '127.0.0.1') + (status.lanMode ? ' (LAN)' : ' (локально)'))
      : 'сервер зупинено';
    $('urlText').textContent = (status && status.url) || ('http://127.0.0.1:' + (($('portInput').value) || 8787));
    if (status && status.port) $('portInput').value = String(status.port);

    const club = status && status.club;
    if (!club || !club.hasPayload) {
      $('clubMeta').textContent = 'файлу ще немає — завантажте JSON тренера';
    } else {
      const when = club.updatedAt ? String(club.updatedAt).slice(0, 19).replace('T', ' ') : '—';
      $('clubMeta').textContent =
        (club.playerCount || 0) + ' гравців · оновлено ' + when +
        (club.updatedBy ? ' · ' + club.updatedBy : '');
    }

    $('btnStart').disabled = running;
    $('btnStop').disabled = !running;
    $('portInput').disabled = running;
  }

  async function refresh() {
    if (!api) {
      msg('Відкрийте через Electron (start.bat), не в браузері', 'err');
      return;
    }
    try {
      paint(await api.status());
    } catch (e) {
      msg(String(e.message || e), 'err');
    }
  }

  $('btnStart').addEventListener('click', async () => {
    msg('Запуск…');
    const port = Number($('portInput').value || 8787);
    const res = await api.start({ port, host: '127.0.0.1' });
    if (!res.ok) {
      msg(res.error || 'не вдалося стартувати', 'err');
      if (res.status) paint(res.status);
      return;
    }
    paint(res.status);
    msg('Сервер запущено на ' + res.status.url, 'ok');
  });

  $('btnStop').addEventListener('click', async () => {
    const res = await api.stop();
    paint(res.status);
    msg('Сервер зупинено', 'ok');
  });

  $('btnCopy').addEventListener('click', async () => {
    const url = $('urlText').textContent;
    try {
      await navigator.clipboard.writeText(url);
      msg('URL скопійовано', 'ok');
    } catch (_) {
      msg(url, 'ok');
    }
  });

  $('btnImport').addEventListener('click', async () => {
    const res = await api.importClub();
    if (!res.ok) {
      if (res.error !== 'cancelled') msg(res.error || 'помилка імпорту', 'err');
      return;
    }
    await refresh();
    msg('JSON клубу завантажено на сервер', 'ok');
  });

  $('btnExport').addEventListener('click', async () => {
    const res = await api.exportClub();
    if (!res.ok) {
      if (res.error === 'empty') msg('На сервері ще немає клубного JSON', 'err');
      else if (res.error !== 'cancelled') msg(res.error || 'помилка експорту', 'err');
      return;
    }
    msg('Збережено: ' + res.path, 'ok');
  });

  refresh();
  setInterval(refresh, 4000);
})();
