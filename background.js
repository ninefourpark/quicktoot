// background.js : handle commands for shortcut slots and API publishing
import { buildHabitPostText } from './templates.js'; 

// Chrome OAuth 专用的回调地址
const REDIRECT_URI = chrome.identity.getRedirectURL();


// ============== 创建独立编辑窗口 ==============
async function openThreadEditorWindow(habitId, text) {
  try {
    const url = chrome.runtime.getURL(`thread-editor/thread-editor.html?habitId=${habitId}&text=${encodeURIComponent(text)}`);
    const window = await chrome.windows.create({
      url: url,
      type: 'popup',
      width: 460,
      height: 560,  // 独立窗口的高度
      focused: true
    });
    if (!window) {
      throw new Error('Failed to create window');
    }
    return window;
  } catch (error) {
    console.error('Error creating thread editor window:', error);
    throw error;
  }
}

// ============== 获取或注册客户端应用 ==============
async function getOrRegisterClient(instance) {
  const data = await chrome.storage.local.get({ clients: {} });
  const clients = data.clients || {};

  if (clients[instance]) {
    return clients[instance];
  }

  // 注册新应用
  const response = await fetch(`${instance}/api/v1/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_name: 'QuickToot for Mastodon',
      redirect_uris: REDIRECT_URI,
      scopes: 'read:statuses write:statuses write:media'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to register app: ' + response.statusText);
  }

  const appData = await response.json();
  const client = {
    client_id: appData.client_id,
    client_secret: appData.client_secret
  };

  clients[instance] = client;
  await chrome.storage.local.set({ clients });
  return client;
}

// ============== 获取 access token（只在没有 token 时调用）==============
async function getAccessToken(instance) {
  // 获取客户端凭据
  const client = await getOrRegisterClient(instance);

  // 组合 Mastodon 授权页面 URL
  const authUrl =
  `${instance}/oauth/authorize` +
  `?client_id=${client.client_id}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent('read:statuses write:statuses write:media')}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  console.log(authUrl)

  try {
    // 让 Chrome 打开授权窗口，并等待回跳
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    // 从回跳 URL 中取出一次性 code
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');

    if (!code) throw new Error('No authorization code received');

    // 用 code 换 access token
    const tokenResponse = await fetch(`${instance}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: client.client_id,
        client_secret: client.client_secret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Token request failed');
    }

    const tokenData = await tokenResponse.json();

    // 保存 access token，后续直接使用
    await chrome.storage.local.set({
      accessToken: tokenData.access_token
    });

    return tokenData.access_token;
  } catch (error) {
    console.error('OAuth error:', error);
    let friendlyError = error.message;
    if (error.message === 'Authorization page could not be loaded') {
      friendlyError = '无法加载授权页面，请检查网络连接和实例地址。';
    }
    throw new Error(friendlyError);
  }
}

// ============== 发布嘟文 ==============
async function publishToot(instance, accessToken, text, inReplyToId = null, visibility = 'public') {
  // 从 chrome.storage.local 获取用户的设置
  const data = await new Promise(resolve => {
    chrome.storage.local.get({ defaultVisibility: 'public' }, resolve);
  });

  // 如果没有传入可见性参数，使用默认可见性
  const visibilityToUse = visibility || data.defaultVisibility || 'public';
  
  const url = `${instance}/api/v1/statuses`;
  const body = {
    status: text,
    visibility: visibilityToUse 
  };
  if (inReplyToId) {
    body.in_reply_to_id = inReplyToId;
  }


  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Failed to publish: ${response.status}`);
  }

  return await response.json();
}

// ============== 获取嘟文可见性 ==============
// Function to get status visibility
async function getStatusVisibility(instance, accessToken, statusId) {
  const url = `${instance}/api/v1/statuses/${statusId}`;


  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.status}`);
  }

  const status = await response.json();
  return status.visibility;
}

// 快捷键触发 插件面板&发布串文的独立窗口
chrome.commands.onCommand.addListener(async (command) => { 
  if (command === 'open-panel') {
    handleOpenPanel();
    return;
  }

  const m = command.match(/^shortcut([1-4])$/);
  if (!m) return;
  const slot = Number(m[1]);

  await handleShortcutSlot(slot);
});

async function handleShortcutSlot(slot) {
  const data = await chrome.storage.local.get({
    habits: [],
    emojiDone: '🔥',
    emojiEmpty: '⬜',
    instance: '',
    language: 'zh-cn',
    templates: {},
    enableThreading: false
  });

  const habit = (data.habits || []).find(x => x.shortcutSlot === slot);
  if (!habit) return;

  if (habit.shortcutAction === 'openLink' && habit.link) {
    await chrome.tabs.create({ url: habit.link });
    return;
  }

  if (habit.shortcutAction === 'checkIn') {
    const today = new Date().toISOString().slice(0,10);
    habit.records = habit.records || {};
    habit.records[today] = true;

    const streak = calcStreak(habit.records);
    if (streak > (habit.bestStreak || 0)) habit.bestStreak = streak;

    const heatmap = buildHeatmap(habit.records, data.emojiDone, data.emojiEmpty);

    const text = buildHabitPostText({
      habit,
      streak,
      best: habit.bestStreak || 0,
      total: habit.totalDone || 0,
      heatmap,
      emojiDone: data.emojiDone,
      emojiEmpty: data.emojiEmpty,
      lang: data.language,
      userTemplates: data.templates,
      customTemplate: habit.customTemplate || null
    });

    // 保存更新后的 habit
    const hlist = data.habits || [];
    const idx = hlist.findIndex(x => x.id === habit.id);
    if (idx !== -1) hlist[idx] = habit;
    await chrome.storage.local.set({ habits: hlist });

    // 根据 enableThreading 弹出窗口或 Mastodon 的 share 页面
    if (data.enableThreading) {
      await openThreadEditorWindow(habit.id, text);
    } else {
      const inst = validateAndNormalizeInstance(data.instance) || 'https://example.social';
      const url = inst + "/share?text=" + encodeURIComponent(text);
      await chrome.tabs.create({ url });
    }
  }
}

function handleOpenPanel() {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 500,
    height: 560,
    focused: true
  });
}


function calcStreak(records) {
  let count = 0;
  let d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (records && records[key]) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

function buildHeatmap(records, done, empty) {
  let result = "";
  let d = new Date();

  for (let i = 0; i < 14; i++) {
    const key = d.toISOString().slice(0, 10);
    result = ((records && records[key]) ? done : empty) + result;
    if (i === 6) result = "\n" + result;
    d.setDate(d.getDate() - 1);
  }
  return result;
}

function validateAndNormalizeInstance(input) {
  if (!input) return null;
  let v = input.trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  v = v.replace(/\/$/, '');
  try { const u = new URL(v); if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname && u.hostname.indexOf('.') !== -1) return v; } catch (e) { return null; }
  return null;
}


chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'EXPORT_DATA') {
    const dataContent = msg.json || (msg.payload && msg.payload.json);
    if (!dataContent) return;

    const now = new Date();
    const dateStr = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
    const timeStr = ('0' + now.getHours()).slice(-2) + ('0' + now.getMinutes()).slice(-2);
    const finalFilename = "QuickToot_Export_" + dateStr + "_" + timeStr + ".json";

    const blob = new Blob([dataContent], { type: 'application/json' });
    const reader = new FileReader();

    reader.onload = () => {
      chrome.downloads.download({
        url: reader.result,
        filename: finalFilename,
        conflictAction: 'uniquify',
        saveAs: true
      });
    };

    reader.readAsDataURL(blob);
  }
    const targetId = sender.tab ? sender.tab.windowId : sender.windowId;
  if (targetId && msg.height) {
    chrome.windows.update(targetId, {
      height: Math.round(Math.min(Math.max(msg.height, 350), 800))
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startOAuth') {
    (async () => {
      try {
        const instance = validateAndNormalizeInstance(request.instance);
        if (!instance) throw new Error('Invalid instance');

        await getAccessToken(instance);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'checkToken') {
    chrome.storage.local.get({ accessToken: null }, data => {
      sendResponse({ hasToken: !!data.accessToken });
    });
    return true;
  }

  if (request.action === 'getStatusVisibility') {
    (async () => {
      try {
        const instance = validateAndNormalizeInstance(request.instance);
        if (!instance) throw new Error('Invalid instance');

        const accessToken = await new Promise((resolve, reject) => {
          chrome.storage.local.get({ accessToken: null }, data => {
            if (data.accessToken) {
              resolve(data.accessToken);
            } else {
              reject(new Error('No access token'));
            }
          });
        });

        const visibility = await getStatusVisibility(instance, accessToken, request.statusId);
        sendResponse({ success: true, visibility: visibility });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'publishFromContent') {
    (async () => {
      try {
        const storage = await new Promise(resolve => {
          chrome.storage.local.get(['instance', 'accessToken'], resolve);
        });
        const instance = validateAndNormalizeInstance(storage.instance);
        const accessToken = storage.accessToken;
        if (!instance || !accessToken) throw new Error('Missing instance or access token. 缺少实例或 access token');

        let mediaId = null;

        // 如果有图片，先上传媒体
        if (request.imageBuffer) {
          // 将接收到的普通数组还原为 Uint8Array
          const uint8Array = new Uint8Array(request.imageBuffer);
          const blob = new Blob([uint8Array], { type: request.imageType });
          const formData = new FormData();
          formData.append('file', blob, request.imageName);
          
          if (request.imageAlt) {
            formData.append('description', request.imageAlt);
          }


          const uploadRes = await fetch(`${instance}/api/v1/media`, {
            method: 'POST',
            body: formData,
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          const uploadJson = await uploadRes.json();
          if (!uploadRes.ok || !uploadJson.id) {
            throw new Error(uploadJson.error || '媒体上传失败');
          }
          mediaId = uploadJson.id;
        }

        const postData = {
          status: request.text || '',
          visibility: request.visibility,
          in_reply_to_id: request.inReplyToId || null,
          media_ids: mediaId ? [mediaId] : undefined
        };



        const postRes = await fetch(`${instance}/api/v1/statuses`, {
          method: 'POST',
          body: JSON.stringify(postData),
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const postJson = await postRes.json();
        if (postJson.id) sendResponse({ success: true, statusId: postJson.id });
        else sendResponse({ success: false, error: postJson.error });

      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }


  if (request.action === 'showThreadModalFromPopup') {
    // 直接创建独立窗口，不使用 content script
    openThreadEditorWindow(request.habitId, request.text).catch((error) => {
      console.error('Failed to open thread editor window:', error);
      // 如果创建窗口失败，发送响应通知
      sendResponse({ success: false, error: 'Failed to open editor window' });
    });
    return true;
  }
});



