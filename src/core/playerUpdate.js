/** Анкета гравця для тренера: профіль і подарунок біля імені. Явку ставить лише тренер. */
const PlayerUpdate = {
  TYPE: 'metalist_player_update',

  _norm(value) {
    return String(value || '').trim().replace(/^@/, '').toLowerCase();
  },

  _findPlayer(state, packet) {
    const src = packet && packet.player;
    if (!src) return null;
    const players = (state && state.players) || [];
    if (src.id) {
      const byId = players.find(p => p && String(p.id) === String(src.id));
      if (byId) return byId;
    }
    const nick = this._norm(src.telegramUsername);
    if (!nick) return null;
    return players.find(p => p && this._norm(p.telegramUsername) === nick) || null;
  },

  _giftKey(g) {
    return String((g && (g.uid || g.id)) || '');
  },

  _wornFrom(state, player) {
    if (!player) return null;
    if (player.wornGift && (player.wornGift.key || player.wornGift.giftId)) {
      return {
        key: String(player.wornGift.key || ''),
        giftId: String(player.wornGift.giftId || ''),
        at: player.wornGift.at || (player.stamps && player.stamps.wornGift) || '',
        by: 'player'
      };
    }
    let found = null;
    ((state && state.gifts) || []).forEach(g => {
      if (!g || String(g.playerId) !== String(player.id) || !g.featured) return;
      found = g;
    });
    if (!found) return null;
    return {
      key: this._giftKey(found),
      giftId: String(found.giftId || player.featuredGiftId || ''),
      at: (player.stamps && player.stamps.wornGift) || new Date().toISOString(),
      by: 'player'
    };
  },

  _applyWorn(state, player, worn) {
    if (!player || !worn || (!worn.key && !worn.giftId)) return;
    const current = player.wornGift;
    const incomingPlayer = worn.by === 'player';
    const currentPlayer = !!(current && current.by === 'player');
    const incomingAt = Date.parse(worn.at || '') || 0;
    const currentAt = current ? (Date.parse(current.at || '') || 0) : 0;
    let take = !current || (!current.key && !current.giftId);
    if (!take && incomingPlayer && !currentPlayer) take = true;
    else if (!take && incomingPlayer === currentPlayer && incomingAt >= currentAt) take = true;
    else if (!take && !incomingPlayer && !currentPlayer && incomingAt >= currentAt) take = true;
    const chosenWorn = take ? worn : current;
    player.wornGift = {
      key: String(chosenWorn.key || ''),
      giftId: String(chosenWorn.giftId || ''),
      at: chosenWorn.at || new Date().toISOString(),
      by: chosenWorn.by === 'player' ? 'player' : 'coach'
    };
    player.stamps = player.stamps || {};
    player.stamps.wornGift = player.wornGift.at;
    if (!player.profile) player.profile = {};
    player.profile.featuredGiftId = player.wornGift.key || player.profile.featuredGiftId || '';
    const mine = (state.gifts || []).filter(g => g && String(g.playerId) === String(player.id));
    let gift = mine.find(g => this._giftKey(g) === player.wornGift.key || String(g.id || '') === player.wornGift.key);
    if (!gift && player.wornGift.giftId) gift = mine.find(g => String(g.giftId || '') === player.wornGift.giftId);
    if (!gift) return;
    mine.forEach(g => { g.featured = g === gift; });
    player.featuredGiftId = gift.giftId || player.featuredGiftId || '';
  },

  _takePlayerGifts(state, player, packet) {
    const gone = new Set((((state.settings || {}).removedGiftIds) || []).map(function (id) { return String(id || ''); }));
    if (!state.gifts) state.gifts = [];
    const mine = function () {
      return state.gifts.filter(g => g && String(g.playerId) === String(player.id));
    };
    (packet.gifts || []).forEach(raw => {
      if (!raw || typeof raw !== 'object') return;
      const copy = Object.assign({}, raw, { playerId: player.id, featured: false });
      const keys = [copy.uid, copy.id].map(k => String(k || '')).filter(Boolean);
      if (keys.some(k => gone.has(k))) return;
      if (mine().some(g => keys.some(k => String(g.uid || '') === k || String(g.id || '') === k))) return;
      const gid = String(copy.giftId || '');
      if (gid && mine().some(g => String(g.giftId || '') === gid)) return;
      if (!copy.uid) copy.uid = copy.id || ('g_import_' + Math.random().toString(36).slice(2, 8));
      if (!copy.id) copy.id = copy.uid;
      state.gifts.push(copy);
    });
  },

  build(state, player) {
    if (!player || player.id == null) return null;
    const profile = player.profile || {};
    const worn = this._wornFrom(state, player);
    const featuredGiftKey = worn ? worn.key : '';
    const gifts = ((state && state.gifts) || []).filter(g => g && String(g.playerId) === String(player.id)).map(g => Object.assign({}, g));
    return {
      type: this.TYPE,
      exportedAt: new Date().toISOString(),
      player: {
        id: player.id,
        firstName: player.firstName || '',
        lastName: player.lastName || '',
        birthDate: player.birthDate || profile.birthDate || '',
        phone: player.phone || profile.phone || '',
        telegramUsername: player.telegramUsername || '',
        profilePhoto: player.profilePhoto || '',
        photoUrl: player.photoUrl || '',
        statusText: player.statusText || profile.status || '',
        bio: player.bio || profile.bio || '',
        themeHue: player.themeHue != null ? player.themeHue : (profile.themeHue != null ? profile.themeHue : null),
        featuredGiftId: (worn && worn.giftId) || player.featuredGiftId || '',
        profile: {
          bio: profile.bio || player.bio || '',
          status: profile.status || player.statusText || '',
          phone: profile.phone || player.phone || '',
          social: profile.social || '',
          birthDate: profile.birthDate || player.birthDate || '',
          themeHue: profile.themeHue != null ? profile.themeHue : (player.themeHue != null ? player.themeHue : null)
        }
      },
      featuredGiftKey: featuredGiftKey,
      wornGift: worn,
      gifts: gifts,
      stamps: []
    };
  },

  apply(state, packet) {
    if (!state || !packet || packet.type !== this.TYPE || !packet.player) return { ok: false, reason: 'empty' };
    const player = this._findPlayer(state, packet);
    if (!player) return { ok: false, reason: 'missing' };
    const src = packet.player;
    const before = playersCount(state);
    const prevBirth = String(player.birthDate || (player.profile && player.profile.birthDate) || '');
    if (src.firstName) player.firstName = String(src.firstName).slice(0, 80);
    if (src.lastName) player.lastName = String(src.lastName).slice(0, 80);
    if (!player.profile) player.profile = {};
    const prof = src.profile || {};
    ['bio', 'status', 'phone', 'social', 'birthDate'].forEach(key => {
      if (prof[key] != null) player.profile[key] = String(prof[key]).slice(0, key === 'bio' ? 400 : 200);
    });
    if (prof.themeHue != null) player.profile.themeHue = prof.themeHue;
    if (src.birthDate) player.birthDate = String(src.birthDate).slice(0, 20);
    if (player.profile.birthDate) player.birthDate = player.profile.birthDate;
    if (prof.phone != null) player.phone = player.profile.phone;
    if (prof.status != null) player.statusText = player.profile.status;
    if (prof.bio != null) player.bio = player.profile.bio;
    if (src.themeHue != null) player.themeHue = src.themeHue;
    const when = packet.exportedAt || new Date().toISOString();
    player.stamps = player.stamps || {};
    const nextPhoto = src.profilePhoto || src.photoUrl || '';
    const prevPhoto = player.profilePhoto || player.photoUrl || '';
    if (src.profilePhoto) {
      player.profilePhoto = src.profilePhoto;
      player.photoUrl = src.photoUrl || src.profilePhoto;
    } else if (src.photoUrl) {
      player.photoUrl = src.photoUrl;
    }
    if (nextPhoto && nextPhoto !== prevPhoto) player.stamps.photo = when;
    if (String(player.birthDate || '') !== prevBirth) player.stamps.birthDate = when;
    this._takePlayerGifts(state, player, packet);
    const worn = packet.wornGift || (packet.featuredGiftKey ? {
      key: String(packet.featuredGiftKey),
      giftId: String((src && src.featuredGiftId) || ''),
      at: packet.exportedAt || new Date().toISOString(),
      by: 'player'
    } : null);
    if (worn) this._applyWorn(state, player, worn);
    return {
      ok: true,
      name: [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Гравець',
      stamps: 0,
      missed: 0,
      sameSquad: playersCount(state) === before
    };
  }
};

function playersCount(state) {
  return ((state && state.players) || []).length;
}
