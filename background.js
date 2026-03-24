// background.js
import { buildHabitPostText } from './templates.js';

const REDIRECT_URI = chrome.identity.getRedirectURL();

// ============== 创建独立编辑窗口 ==============
async function openThreadEditorWindow(siteId, habitId, text) {
  const habitParam = habitId != null ? `&habitId=${habitId}` : '';
  const quickTootParam = habitId == null ? '&quickToot=1' : '';
  const url = chrome.runtime.getURL(
    `thread-editor/thread-editor.html?siteId=${siteId}${habitParam}${quickTootParam}&text=${encodeURIComponent(text)}`
  );
  const win = await chrome.windows.create({ url, type: 'popup', width: 460, height: 560, focused: true });
  if (!win) throw new Error('Failed to create window');
  return win;
}

// ============== 获取或注册客户端应用 ==============
async function getOrRegisterClient(site) {
  const clients = site.clients || {};
  if (clients[site.instance]) return clients[site.instance];

  const response = await fetch(`${site.instance}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'QuickToot',
      redirect_uris: REDIRECT_URI,
      scopes: 'read:statuses write:statuses write:media'
    })
  });
  if (!response.ok) throw new Error('Failed to register app: ' + response.statusText);

  const appData = await response.json();
  const client = { client_id: appData.client_id, client_secret: appData.client_secret };

  // 保存 client 到对应 site
  const data = await chrome.storage.local.get({ sites: [] });
  const sites = data.sites || [];
  const si = sites.findIndex(s => s.id === site.id);
  if (si !== -1) {
    sites[si].clients = sites[si].clients || {};
    sites[si].clients[site.instance] = client;
    await chrome.storage.local.set({ sites });
  }
  return client;
}

// ============== 获取 access token ==============
async function getAccessToken(site) {
  const client = await getOrRegisterClient(site);
  const authUrl =
    `${site.instance}/oauth/authorize` +
    `?client_id=${client.client_id}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('read:statuses write:statuses write:media')}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  try {
    const redirectUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('No authorization code received');

    const tokenResponse = await fetch(`${site.instance}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: client.client_id,
        client_secret: client.client_secret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    if (!tokenResponse.ok) throw new Error('Token request failed');
    const tokenData = await tokenResponse.json();

    // 保存 accessToken 到对应 site
    const data = await chrome.storage.local.get({ sites: [] });
    const sites = data.sites || [];
    const si = sites.findIndex(s => s.id === site.id);
    if (si !== -1) {
      sites[si].accessToken = tokenData.access_token;
      await chrome.storage.local.set({ sites });
    }
    return tokenData.access_token;
  } catch (error) {
    let msg = error.message;
    if (msg === 'Authorization page could not be loaded') msg = '无法加载授权页面，请检查网络连接和实例地址。';
    throw new Error(msg);
  }
}

// ============== 发布嘟文 ==============
async function publishToot(site, text, inReplyToId = null) {
  const { instance, accessToken, defaultVisibility } = site;
  const body = {
    status: text,
    visibility: defaultVisibility || 'public',
    ...(inReplyToId ? { in_reply_to_id: inReplyToId } : {})
  };
  const response = await fetch(`${instance}/api/v1/statuses`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Failed to publish: ${response.status}`);
  return await response.json();
}

// ============== 获取嘟文可见性 ==============
async function getStatusVisibility(instance, accessToken, statusId) {
  const response = await fetch(`${instance}/api/v1/statuses/${statusId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Failed to get status: ${response.status}`);
  const status = await response.json();
  return status.visibility;
}

// ============== 辅助函数 ==============
function validateAndNormalizeInstance(input) {
  if (!input) return null;
  let v = input.trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  v = v.replace(/\/$/, '');
  try {
    const u = new URL(v);
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname && u.hostname.indexOf('.') !== -1) return v;
  } catch (e) { return null; }
  return null;
}

function calcStreak(records) {
  let count = 0;
  let d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (records && records[key]) { count++; d.setDate(d.getDate() - 1); } else break;
  }
  return count;
}

function buildHeatmap(records, done, empty) {
  let result = '';
  let d = new Date();
  for (let i = 0; i < 14; i++) {
    const key = d.toISOString().slice(0, 10);
    result = ((records && records[key]) ? done : empty) + result;
    if (i === 6) result = '\n' + result;
    d.setDate(d.getDate() - 1);
  }
  return result;
}

function handleOpenPanel() {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup', width: 500, height: 560, focused: true
  });
}

// ============== 快捷键命令处理 ==============
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-panel') { handleOpenPanel(); return; }
  const m = command.match(/^shortcut([1-4])$/);
  if (!m) return;
  await handleShortcutSlot(Number(m[1]));
});

async function handleShortcutSlot(slot) {
  const data = await chrome.storage.local.get({ sites: [], activeSiteId: null });
  const sites = data.sites || [];

  // 先查「写单条嘟嘟」快捷键
  for (const site of sites) {
    if (site.quickTootSlot === slot) {
      await handleQuickToot(site);
      return;
    }
  }

  // 再查话题快捷键
  for (const site of sites) {
    const habit = (site.habits || []).find(h => h.shortcutSlot === slot);
    if (habit) {
      await handleHabitCheckIn(site, habit);
      return;
    }
  }
}

async function handleQuickToot(site) {
  const inst = validateAndNormalizeInstance(site.instance) || 'https://example.social';
  if (site.enableThreading) {
    // 打开 thread-editor，不绑定 habitId（单条模式）
    await openThreadEditorWindow(site.id, null, '');
  } else {
    await chrome.tabs.create({ url: inst + '/share?text=' });
  }
}

async function handleHabitCheckIn(site, habit) {
  if (habit.shortcutAction === 'openLink' && habit.link) {
    await chrome.tabs.create({ url: habit.link });
    return;
  }

  if (habit.shortcutAction === 'checkIn') {
    const today = new Date().toISOString().slice(0, 10);
    habit.records = habit.records || {};
    habit.records[today] = true;

    const streak = calcStreak(habit.records);
    if (streak > (habit.bestStreak || 0)) habit.bestStreak = streak;

    const heatmap = buildHeatmap(habit.records, site.emojiDone || '🔥', site.emojiEmpty || '⬜');
    const text = buildHabitPostText({
      habit,
      streak,
      best: habit.bestStreak || 0,
      total: habit.totalDone || 0,
      heatmap,
      siteTemplate: site.template !== undefined ? site.template : null,
      customTemplate: habit.customTemplate || null
    });

    // 保存更新后的 habit
    const stored = await chrome.storage.local.get({ sites: [] });
    const sites = stored.sites || [];
    const si = sites.findIndex(s => s.id === site.id);
    if (si !== -1) {
      const hi = sites[si].habits.findIndex(h => h.id === habit.id);
      if (hi !== -1) sites[si].habits[hi] = habit;
      await chrome.storage.local.set({ sites });
    }

    if (site.enableThreading) {
      await openThreadEditorWindow(site.id, habit.id, text);
    } else {
      const inst = validateAndNormalizeInstance(site.instance) || 'https://example.social';
      await chrome.tabs.create({ url: inst + '/share?text=' + encodeURIComponent(text) });
    }
  }
}

// ============== 消息监听 ==============
chrome.runtime.onMessage.addListener((msg, sender) => {
  // 导出文件
  if (msg.type === 'EXPORT_DATA') {
    const dataContent = msg.json || (msg.payload && msg.payload.json);
    if (!dataContent) return;
     // 文件名由调用方传入，携带备份/迁移语义及 SENSITIVE 前缀等信息
      const filename = msg.filename || (() => {
        const now = new Date();
        const d = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const t = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        return `QuickToot_Export_${d}_${t}.json`;
      })();
    const blob = new Blob([dataContent], { type: 'application/json' });
    const reader = new FileReader();
    reader.onload = () => {
      chrome.downloads.download({
        url: reader.result,
        filename,
        conflictAction: 'uniquify',
        saveAs: true
      });
    };
    reader.readAsDataURL(blob);
  }

  // 窗口高度
  const targetId = sender.tab ? sender.tab.windowId : sender.windowId;
  if (targetId && msg.height) {
    chrome.windows.update(targetId, { height: Math.round(Math.min(Math.max(msg.height, 350), 800)) });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // OAuth
  if (request.action === 'startOAuth') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get({ sites: [] });
        const site = (stored.sites || []).find(s => s.id === Number(request.siteId));
        if (!site) throw new Error('找不到站点');
        if (!validateAndNormalizeInstance(site.instance)) throw new Error('Invalid instance');
        await getAccessToken(site);
        sendResponse({ success: true });
      } catch (error) { sendResponse({ success: false, error: error.message }); }
    })();
    return true;
  }

  // 检查 token
  if (request.action === 'checkToken') {
    (async () => {
      const stored = await chrome.storage.local.get({ sites: [] });
      const site = (stored.sites || []).find(s => s.id === Number(request.siteId));
      sendResponse({ hasToken: !!(site && site.accessToken) });
    })();
    return true;
  }

  // 获取嘟文可见性
  if (request.action === 'getStatusVisibility') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get({ sites: [] });
        const site = (stored.sites || []).find(s => s.id === Number(request.siteId));
        if (!site || !site.accessToken) throw new Error('No access token');
        const visibility = await getStatusVisibility(site.instance, site.accessToken, request.statusId);
        sendResponse({ success: true, visibility });
      } catch (error) { sendResponse({ success: false, error: error.message }); }
    })();
    return true;
  }

  // 发布嘟文（来自 thread-editor）
  if (request.action === 'publishFromContent') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get({ sites: [] });
        const siteId = Number(request.siteId);
        const site = (stored.sites || []).find(s => s.id === siteId);
        if (!site || !site.instance || !site.accessToken) throw new Error('缺少站点信息或 access token');

        let mediaId = null;
        if (request.imageBuffer) {
          const uint8Array = new Uint8Array(request.imageBuffer);
          const blob = new Blob([uint8Array], { type: request.imageType });
          const formData = new FormData();
          formData.append('file', blob, request.imageName);
          if (request.imageAlt) formData.append('description', request.imageAlt);
          const uploadRes = await fetch(`${site.instance}/api/v1/media`, {
            method: 'POST', body: formData,
            headers: { Authorization: `Bearer ${site.accessToken}` }
          });
          const uploadJson = await uploadRes.json();
          if (!uploadRes.ok || !uploadJson.id) throw new Error(uploadJson.error || '媒体上传失败');
          mediaId = uploadJson.id;
        }

        const postData = {
          status: request.text || '',
          visibility: request.visibility,
          in_reply_to_id: request.inReplyToId || null,
          media_ids: mediaId ? [mediaId] : undefined
        };
        const postRes = await fetch(`${site.instance}/api/v1/statuses`, {
          method: 'POST', body: JSON.stringify(postData),
          headers: { 'Authorization': `Bearer ${site.accessToken}`, 'Content-Type': 'application/json' }
        });
        const postJson = await postRes.json();
        if (postJson.id) sendResponse({ success: true, statusId: postJson.id });
        else sendResponse({ success: false, error: postJson.error });
      } catch (e) { sendResponse({ success: false, error: e.message }); }
    })();
    return true;
  }

  // 打开 thread-editor 窗口
  if (request.action === 'showThreadModalFromPopup') {
    openThreadEditorWindow(request.siteId, request.habitId, request.text)
      .catch(err => { console.error('Failed to open thread editor:', err); sendResponse({ success: false }); });
    return true;
  }
});