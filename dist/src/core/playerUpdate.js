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

  build(state, player) {
    if (!player || player.id == null) return null;
    const profile = player.profile || {};
    let featuredGiftKey = '';
    ((state && state.gifts) || []).forEach(g => {
      if (!g || String(g.playerId) !== String(player.id) || !g.featured) return;
      featuredGiftKey = g.uid || g.id || featuredGiftKey;
    });
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
        featuredGiftId: player.featuredGiftId || '',
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
      stamps: []
    };
  },

  apply(state, packet) {
    if (!state || !packet || packet.type !== this.TYPE || !packet.player) return { ok: false, reason: 'empty' };
    const player = this._findPlayer(state, packet);
    if (!player) return { ok: false, reason: 'missing' };
    const src = packet.player;
    const before = playersCount(state);
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
    if (src.profilePhoto) {
      player.profilePhoto = src.profilePhoto;
      player.photoUrl = src.photoUrl || src.profilePhoto;
    } else if (src.photoUrl) {
      player.photoUrl = src.photoUrl;
    }
    if (packet.featuredGiftKey) {
      const key = String(packet.featuredGiftKey);
      (state.gifts || []).forEach(g => {
        if (!g || String(g.playerId) !== String(player.id)) return;
        const hit = String(g.uid || '') === key || String(g.id || '') === key;
        g.featured = hit;
        if (hit) player.featuredGiftId = g.giftId || player.featuredGiftId || '';
      });
    }
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
