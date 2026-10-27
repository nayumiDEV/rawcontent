(async () => {
  'use strict';

  if (typeof window.webpackChunkdiscord_app === 'undefined') {
    console.error('[spoofer] discord desktop client required');
    return;
  }

  const config = {
    totalHours: 60000, // target total playtime hours (e.g. 5000, 10000)
    titles: 500,
    batchSize: 25,
    delay: 450,
    wobble: false,
    dryRun: false
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomId = () => crypto.randomUUID();

  const wp = webpackChunkdiscord_app.push([[Symbol()], {}, (r) => r]);
  webpackChunkdiscord_app.pop();

  let rest = null;
  try {
    const entry = Object.entries(wp.m).find(([_, fn]) => fn.toString().includes('HTTPUtils'));
    if (entry) {
      const exp = wp(entry[0]);
      rest = Object.values(exp).find((e) => typeof e?.del === 'function' && typeof e?.get === 'function' && typeof e?.post === 'function') || exp;
    }
  } catch (_) {}

  if (!rest) {
    for (const mod of Object.values(wp.c)) {
      if (!mod?.exports) continue;
      const candidates = [mod.exports, mod.exports.default, ...Object.values(mod.exports)];
      for (const target of candidates) {
        if (target && typeof target?.get === 'function' && typeof target?.del === 'function' && typeof target?.post === 'function') {
          rest = target;
          break;
        }
      }
      if (rest) break;
    }
  }

  if (!rest) {
    console.error('[spoofer] failed to resolve rest module');
    return;
  }

  let analyticsToken = null;
  let username = 'user';
  let userId = '';

  try {
    const me = await rest.get({ url: '/users/@me', query: { with_analytics_token: true } });
    analyticsToken = me.body?.analytics_token;
    username = me.body?.username || 'user';
    userId = me.body?.id || '';
    if (!analyticsToken) throw new Error('token missing');
  } catch (err) {
    console.error('[spoofer] failed to fetch analytics token', err);
    return;
  }

  const generateFingerprint = async (uid) => {
    const enc = new TextEncoder();
    const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    const guid = randomId();
    const machineUserHash = await sha256(enc.encode(guid + uid));
    const headerHash = await sha256(enc.encode('pe_header_' + uid));
    const sectionHash = await sha256(enc.encode('pe_section_' + uid));
    const certHash = await sha256(enc.encode('pe_cert_' + uid));

    const buf = new Uint8Array(146);
    const view = new DataView(buf.buffer);
    buf[0] = 1;
    buf[1] = 1;
    view.setBigUint64(2, 65432100n, true);
    view.setUint32(10, 1690000000, true);
    view.setUint32(14, 0x02500000, true);
    buf.set(headerHash, 18);
    buf.set(machineUserHash, 50);
    buf.set(sectionHash, 82);
    buf.set(certHash, 114);

    const key = await sha256(enc.encode(uid + 'https://discord.com/careers'));
    for (let i = 1; i < buf.length; i++) {
      buf[i] ^= key[(i - 1) & 31];
    }

    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return btoa(binary);
  };

  const fingerprint = await generateFingerprint(userId);

  let rawCatalog = [];
  try {
    const res = await rest.get({ url: '/applications/detectable' });
    rawCatalog = res.body || [];
  } catch (_) {
    try {
      const res = await fetch('https://cdn.discordapp.com/detectables/games.json');
      rawCatalog = await res.json();
    } catch (err) {
      console.error('[spoofer] failed to load game catalog', err);
      return;
    }
  }

  const catalog = [];
  const seen = new Set();

  for (const item of rawCatalog) {
    if (!item?.id || seen.has(item.id)) continue;
    const winExe = item.executables?.find((e) => e?.os === 'win32')?.name;
    if (!winExe && (!item.executables || item.executables.length > 0)) continue;
    const exe = winExe || `${item.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'game'}.exe`;
    seen.add(item.id);
    catalog.push({ id: String(item.id), name: item.name, exe });
  }

  if (!catalog.length) {
    console.error('[spoofer] no valid win32 games found');
    return;
  }

  const selected = catalog.sort(() => Math.random() - 0.5).slice(0, Math.min(config.titles, catalog.length));
  const hoursPerGame = config.totalHours / Math.max(1, selected.length);

  console.log(`[spoofer] connected as ${username} | fingerprint bound | target: ${config.totalHours}h across ${selected.length} games (~${hoursPerGame.toFixed(1)}h/game)`);

  window.__gameTimeForgeActive = true;
  window.__stopGameTimeForge = () => {
    window.__gameTimeForgeActive = false;
    console.warn('[spoofer] stopped by user');
  };

  const session = {
    heartbeatId: randomId(),
    signature: randomId(),
    seq: 0
  };

  const buildLaunch = (game, timestamp) => ({
    type: 'launch_game',
    properties: {
      client_track_timestamp: timestamp,
      client_heartbeat_session_id: session.heartbeatId,
      event_sequence_number: ++session.seq,
      game: game.name,
      game_id: game.id,
      verified: true,
      elevated: false,
      is_launcher: false,
      game_platform: 'desktop',
      detection_method: 'verified_game',
      is_overlay_enabled: false,
      is_overlay_game_enabled: true,
      is_overlay_game_source: 'OOP_DEFAULT_DATABASE',
      fullscreen_type: 'UNKNOWN',
      hardware_display_count: 1,
      overlay_method: 'Disabled',
      activity_status_enabled: true,
      activity_status_shared_guilds: [],
      current_user_status: 'online',
      game_detection_enabled: true,
      executable_path: game.exe,
      voice_channel_id: null,
      voice_channel_type: null,
      voice_channel_bitrate: null,
      voice_channel_guild_id: null,
      hidden_by_distributor: false,
      game_metadata: null,
      executable_fingerprint: fingerprint,
      client_performance_cpu: null,
      client_performance_memory: null,
      cpu_core_count: null,
      accessibility_features: 0,
      rendered_locale: 'en-US',
      launch_signature: session.signature,
      client_rtc_state: null,
      client_app_state: 'focused',
      client_send_timestamp: timestamp
    }
  });

  const buildHeartbeat = (game, durationMs, sid, initial, final, timestamp) => ({
    type: 'running_game_heartbeat',
    properties: {
      client_track_timestamp: timestamp,
      client_heartbeat_session_id: session.heartbeatId,
      event_sequence_number: ++session.seq,
      game_id: game.id,
      game_name: game.name,
      game_metadata: null,
      game_executable: game.exe,
      game_detection_enabled: true,
      initial_heartbeat: initial,
      final_heartbeat: final,
      game_session_id: sid,
      duration_tracked_ms: durationMs,
      rtc_connection_id: null,
      media_session_id: null,
      launch_signature: session.signature,
      client_app_state: 'focused',
      client_send_timestamp: timestamp
    }
  });

  const buildTriplet = (game, baseHours) => {
    const drift = config.wobble ? 1 + (Math.random() * 0.06 - 0.03) : 1;
    const hours = Math.max(0.1, baseHours * drift);
    const durationMs = Math.floor(hours * 3600 * 1000);
    const now = Date.now();
    const start = now - durationMs;
    const sid = randomId();

    return {
      hours,
      events: [
        buildHeartbeat(game, 0, sid, true, false, start),
        buildLaunch(game, now),
        buildHeartbeat(game, durationMs, sid, false, true, now)
      ]
    };
  };

  let loggedHours = 0;
  let forgedCount = 0;
  const totalBatches = Math.ceil(selected.length / config.batchSize);

  for (let i = 0; i < totalBatches; i++) {
    if (!window.__gameTimeForgeActive) break;

    const chunk = selected.slice(i * config.batchSize, (i + 1) * config.batchSize);
    const events = [];
    let chunkHours = 0;

    for (const game of chunk) {
      const triplet = buildTriplet(game, hoursPerGame);
      events.push(...triplet.events);
      chunkHours += triplet.hours;
    }

    if (config.dryRun) {
      forgedCount += chunk.length;
      loggedHours += chunkHours;
      console.log(`[spoofer] [dry-run] batch ${i + 1}/${totalBatches} (${chunkHours.toFixed(1)}h)`);
    } else {
      try {
        const res = await rest.post({
          url: '/science',
          body: { token: analyticsToken, events }
        });

        if (res?.status === 204 || res?.status === 200 || res?.ok) {
          forgedCount += chunk.length;
          loggedHours += chunkHours;
          console.log(`[spoofer] batch ${i + 1}/${totalBatches} sent (+${chunkHours.toFixed(1)}h)`);
        } else {
          console.warn(`[spoofer] batch ${i + 1}/${totalBatches} response: ${res?.status}`);
        }
      } catch (err) {
        console.error(`[spoofer] batch ${i + 1}/${totalBatches} failed`, err);
        if (err?.status === 429) {
          console.warn('[spoofer] rate limited, cooling down 5s...');
          await sleep(5000);
        }
      }
    }

    const jitter = config.delay + Math.floor((Math.random() - 0.5) * 150);
    await sleep(Math.max(100, jitter));
  }

  delete window.__gameTimeForgeActive;
  console.log(`[spoofer] done: ${forgedCount}/${selected.length} games forged | total playtime: ${loggedHours.toFixed(1)}h`);
})();
