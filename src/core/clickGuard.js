/** Яка ціль кліку справжня. Координати панелі не відбирають кнопку, яку натиснули. */
const ClickGuard = {
  ownControl(node) {
    if (!node || !node.closest) return null;
    return node.closest('button, a, input, select, textarea, [data-action], [data-export-act], [data-sheet-act], [data-modal-action], [data-view], [data-psheet], [data-sq]');
  },

  /** Ім'я в заявці матчу або в списку складу. Нижня панель його не забирає. */
  matchSquadClick(node) {
    if (!node || !node.closest) return null;
    if (node.closest('.match-savebar')) return null;
    return node.closest('.match-chip, [data-action="match-toggle"], [data-pick-player], .roster-pick');
  },

  /**
   * true — клік належить нижній панелі.
   * Кнопка, меню і модалка лишаються своїми, навіть якщо стоять низько на екрані.
   */
  stealNav(node, x, y) {
    if (!node || !node.closest) return false;
    const nav = typeof document !== 'undefined' && document.getElementById && document.getElementById('mobileNav');
    if (!nav || !nav.getBoundingClientRect) return !!node.closest('#mobileNav, .mn');
    const band = nav.getBoundingClientRect();
    if (band.height < 2) return false;
    const inBand = y >= band.top - 4 && y <= band.bottom + 4 && x >= band.left - 8 && x <= band.right + 8;
    if (this.matchSquadClick(node)) return false;
    if (node.closest('#mobileNav, .mn')) return true;
    if (!inBand) return false;
    if (node.closest('#sidebar, .sidebar, #modal, .md, .mo, .tg-sheet, .tg-sheet-backdrop, .sw-sheet, .match-plan, .match-toolbar, .match-savebar, [data-action="match-save"], [data-action="match-warmup"], [data-action="match-logo"]')) return false;
    const own = this.ownControl(node);
    if (!own || !own.getBoundingClientRect) return true;
    const r = own.getBoundingClientRect();
    if (r.height < 2) return true;
    if (r.bottom <= band.top + 6) return false;
    if (r.width >= 8 && r.height <= 72) return false;
    return true;
  },

  trainingOpensSheet(node) {
    if (!node || !node.closest) return false;
    if (this.matchSquadClick(node) || node.closest('.match-plan, #modal, .mo, .roster-pick, .tg-next-btn, .match-plaque, .match-toolbar')) return false;
    const explicit = node.closest('[data-action]');
    if (explicit) {
      const act = explicit.getAttribute('data-action') || '';
      if (act && act !== 'open-training' && act !== 'preview-next-training') return false;
    }
    const opener = node.closest('[data-action="open-training"], [data-action="preview-next-training"], [data-next-training]');
    if (!opener) return false;
    const own = node.closest('[data-action], [data-edit-training], [data-attendance-training], [data-del-training], [data-dup-training]');
    if (own && own !== opener) {
      const action = own.getAttribute('data-action') || '';
      if (action && action !== 'open-training' && action !== 'preview-next-training') return false;
    }
    return true;
  },

  coachCardClick(node) {
    if (!node || !node.closest) return false;
    if (node.closest('#modal, .mo, .coach-card-overlay, input, select, textarea')) return false;
    const host = node.closest('.coach-public-card, .coach-squad-card, [data-coach-card="1"], [data-action="open-coach-card"], [data-action="coach-easter"]');
    if (!host) return false;
    const own = this.ownControl(node);
    if (own && own !== host) {
      const action = own.getAttribute('data-action') || '';
      if (action !== 'open-coach-card' && action !== 'coach-easter') return false;
    }
    return true;
  }
};
