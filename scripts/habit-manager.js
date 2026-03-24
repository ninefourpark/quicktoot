/**
 * 习惯数据管理模块
 */

export function normalizeInstance(input) {
  if (!input) return '';
  let v = input.trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  v = v.replace(/\/$/, '');
  return v;
}

export function validateAndNormalizeInstance(input) {
  if (!input) return null;
  const v = normalizeInstance(input);
  try {
    const u = new URL(v);
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname && u.hostname.indexOf('.') !== -1) return v;
  } catch (e) { return null; }
  return null;
}

export function truncateDomain(instance) {
  if (!instance) return '新站点';
  try {
    const host = new URL(instance).hostname;
    return host.length > 12 ? host.slice(0, 11) + '…' : host;
  } catch { return instance.slice(0, 12); }
}

export function getSiteDisplayName(site) {
  if (site.name && site.name.trim()) return site.name.trim();
  return truncateDomain(site.instance);
}

export function migrateToMultiSite(data) {
  if (data.sites && Array.isArray(data.sites)) return null;
  const siteId = Date.now();
  const site = {
    id: siteId,
    name: '',
    instance: data.instance || '',
    enableThreading: data.enableThreading || false,
    defaultVisibility: data.defaultVisibility || 'public',
    template: (data.templates && data.templates['zh-cn']) || null,
    emojiDone: data.emojiDone || '🔥',
    emojiEmpty: data.emojiEmpty || '⬜',
    habits: data.habits || [],
    accessToken: data.accessToken || null,
    clients: data.clients ? { ...data.clients } : {},
    quickTootSlot: null,
  };
  return { sites: [site], activeSiteId: siteId };
}

export function calcStreak(records) {
  let count = 0;
  let d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (records[key]) { count++; d.setDate(d.getDate() - 1); } else break;
  }
  return count;
}

export function buildHeatmap(records, done, empty) {
  let result = '';
  let d = new Date();
  for (let i = 0; i < 14; i++) {
    const key = d.toISOString().slice(0, 10);
    result = (records[key] ? done : empty) + result;
    if (i === 6) result = '\n' + result;
    d.setDate(d.getDate() - 1);
  }
  return result;
}

export function deleteHabitById(siteId, habitId, callback) {
  chrome.storage.local.get({ sites: [] }, data => {
    const sites = data.sites || [];
    const si = sites.findIndex(s => s.id === siteId);
    if (si === -1) return callback && callback();
    sites[si].habits = (sites[si].habits || []).filter(h => h.id !== habitId);
    chrome.storage.local.set({ sites }, () => callback && callback());
  });
}

export function moveHabitById(siteId, habitId, dir, onSuccess) {
  chrome.storage.local.get({ sites: [] }, data => {
    const sites = data.sites || [];
    const si = sites.findIndex(s => s.id === siteId);
    if (si === -1) return;
    const h = sites[si].habits || [];
    const i = h.findIndex(x => x.id === habitId);
    if (i === -1) return;
    const ni = i + dir;
    if (ni < 0 || ni >= h.length) return;
    [h[i], h[ni]] = [h[ni], h[i]];
    chrome.storage.local.set({ sites }, onSuccess);
  });
}

export function isHabitDoneToday(habit) {
  const today = new Date().toISOString().slice(0, 10);
  return !!(habit.records && habit.records[today]);
}

export function getUsedSlots(sites) {
  const used = {};
  for (const site of sites) {
    if (site.quickTootSlot) {
      used[site.quickTootSlot] = { siteId: site.id, siteName: getSiteDisplayName(site), habitId: null, habitTitle: null, type: 'quickToot' };
    }
    for (const habit of (site.habits || [])) {
      if (habit.shortcutSlot) {
        used[habit.shortcutSlot] = { siteId: site.id, siteName: getSiteDisplayName(site), habitId: habit.id, habitTitle: habit.title, type: 'habit' };
      }
    }
  }
  return used;
}