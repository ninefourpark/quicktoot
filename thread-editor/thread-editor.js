// thread-editor.js
import { stripMentions } from '../utils.js';

const textArea = document.getElementById('threadModalText');
const newRadio = document.getElementById('threadNew');
const replyRadio = document.getElementById('threadReply');
const idDiv = document.getElementById('threadIdDiv');
const idInput = document.getElementById('threadIdInput');
const idExplain = document.getElementById('threadIdExplain');
const idInfo = document.getElementById('threadIdInfo');
const visibilitySelect = document.getElementById('threadVisibility');
const errorEl = document.getElementById('threadModalError');
const publishBtn = document.getElementById('threadModalPublishBtn');
const cancelBtn = document.getElementById('threadModalCancelBtn');
const toggleBtn = document.getElementById('toggleImageUpload');
const imageUploadDiv = document.getElementById('imageUploadDiv');
const imageInput = document.getElementById('threadImage');
const imageAltInput = document.getElementById('threadImageAlt');

let currentHabit = null;   // null 表示「写单条嘟嘟」模式
let currentSite = null;
let defaultVisibility = 'public';

// ============== 图片上传开关 ==============
toggleBtn.addEventListener('click', () => {
  const isOpen = imageUploadDiv.classList.toggle('is-open');
  toggleBtn.setAttribute('aria-expanded', isOpen);
  toggleBtn.textContent = isOpen ? '− 移除图片' : '＋ 添加图片';
});

// ============== 可见性选项 ==============
const VISIBILITY_OPTIONS = ['public', 'unlisted', 'private', 'direct'];
const VISIBILITY_LABELS = { public: '公开', unlisted: '悄悄公开', private: '仅关注者可见', direct: '私信' };

// 渲染全部可见性选项，仅设置默认选中值（用于「写单条嘟嘟」）
function setVisibilityDefault(defaultValue) {
  visibilitySelect.innerHTML = '';
  VISIBILITY_OPTIONS.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = VISIBILITY_LABELS[v];
    visibilitySelect.appendChild(opt);
  });
  visibilitySelect.value = defaultValue || 'public';
}

// 渲染从 minVisibility 起的选项并选中（用于串文回复，继承上一条可见性）
function setVisibilityOptions(minVisibility) {
  const allowed = VISIBILITY_OPTIONS.slice(VISIBILITY_OPTIONS.indexOf(minVisibility));
  visibilitySelect.innerHTML = '';
  allowed.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = VISIBILITY_LABELS[v];
    visibilitySelect.appendChild(opt);
  });
  visibilitySelect.value = minVisibility;
}

function getVisibilityFromServer(statusId) {
  chrome.runtime.sendMessage(
    { action: 'getStatusVisibility', statusId, siteId: currentSite.id },
    (response) => {
      if (response && response.success) {
        setVisibilityOptions(response.visibility);
        errorEl.style.display = 'none';
      } else {
        setVisibilityOptions('public');
        errorEl.textContent = '未能找到您要回复的嘟文。请确认实例地址、嘟文编号正确，以及嘟文尚未被删除。';
        errorEl.style.display = 'block';
      }
    }
  );
}

// ============== 串文方式切换 ==============
newRadio.onchange = () => {
  if (newRadio.checked) {
    idDiv.style.display = 'none';
    if (currentHabit === null) {
      // 写单条嘟嘟：全部选项可选，默认为实例设置值
      setVisibilityDefault(defaultVisibility);
    } else {
      // 话题模式：新开串文，同样无继承限制
      setVisibilityDefault(defaultVisibility);
    }
  }
};

replyRadio.onchange = () => {
  if (!replyRadio.checked) return;
  idDiv.style.display = 'block';
  idExplain.style.display = 'block';
  if (currentHabit && currentHabit.root_status_id) {
    idInput.value = currentHabit.last_status_id || currentHabit.root_status_id;
    idInput.readOnly = false;
    idInfo.textContent = '已绑定串文，即将回复给：' + (currentHabit.last_status_id || currentHabit.root_status_id);
    idInfo.style.display = 'block';
    getVisibilityFromServer(currentHabit.last_status_id || currentHabit.root_status_id);
  } else {
    idInput.value = '';
    idInput.readOnly = false;
    idInfo.style.display = 'none';
    setVisibilityOptions('public');
  }
};

idInput.oninput = () => {
  const id = idInput.value.trim();
  if (id && replyRadio.checked) {
    idInfo.style.display = 'none';
    getVisibilityFromServer(id);
  } else if (!id && replyRadio.checked) {
    setVisibilityOptions('public');
  }
};

// ============== 键盘快捷键 ==============
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); publishBtn.click(); }
  else if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
});

cancelBtn.onclick = () => window.close();

window.onload = () => {
  chrome.runtime.sendMessage({ action: 'resizeWindow', height: document.body.scrollHeight });
};

// ============== 发布 ==============
publishBtn.onclick = () => {
  const text = textArea.value.trim();
  const file = imageInput.files[0];
  const safeText = stripMentions(text);

  if (!text && !file) {
    errorEl.textContent = '请输入内容';
    errorEl.style.display = 'block';
    return;
  }

  const visibility = visibilitySelect.value;
  const isReply = replyRadio.checked;
  const inReplyToId = isReply ? idInput.value.trim() : null;

  if (isReply && !inReplyToId) {
    errorEl.textContent = '请输入嘟文编号';
    errorEl.style.display = 'block';
    return;
  }

  const message = {
    action: 'publishFromContent',
    text: safeText,
    visibility,
    inReplyToId,
    siteId: currentSite.id,
    habitId: currentHabit ? currentHabit.id : null,
    isNewThread: !isReply,
  };

  function sendPublish() {
    chrome.runtime.sendMessage(message, handleResponse);
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      message.imageBuffer = Array.from(new Uint8Array(e.target.result));
      message.imageName = file.name;
      message.imageType = file.type;
      message.imageAlt = imageAltInput.value.trim();
      sendPublish();
    };
    reader.readAsArrayBuffer(file);
  } else {
    sendPublish();
  }

  function handleResponse(response) {
    if (response && response.success) {
      // 只有在话题模式下才需要更新 habit 的串文 ID
      if (currentHabit) {
        chrome.storage.local.get({ sites: [] }, data => {
          const sites = data.sites || [];
          const si = sites.findIndex(s => s.id === currentSite.id);
          if (si !== -1) {
            const hi = sites[si].habits.findIndex(h => h.id === currentHabit.id);
            if (hi !== -1) {
              if (!isReply) {
                sites[si].habits[hi].root_status_id = response.statusId;
                sites[si].habits[hi].last_status_id = response.statusId;
              } else {
                sites[si].habits[hi].last_status_id = response.statusId;
                if (!sites[si].habits[hi].root_status_id) sites[si].habits[hi].root_status_id = inReplyToId;
              }
              chrome.storage.local.set({ sites }, () => window.close());
            }
          }
        });
      } else {
        window.close();
      }
    } else {
      errorEl.textContent = (response && response.error) || '发布失败';
      errorEl.style.display = 'block';
    }
  }
};

// ============== 初始化 ==============
function initialize() {
  const urlParams = new URLSearchParams(window.location.search);
  const siteIdRaw = urlParams.get('siteId');
  const habitIdRaw = urlParams.get('habitId');
  const isQuickToot = urlParams.get('quickToot') === '1';
  const textParam = urlParams.get('text') ? decodeURIComponent(urlParams.get('text')) : '';

  // siteId 必须存在且是有效数字
  const siteIdParam = siteIdRaw ? Number(siteIdRaw) : null;
  // habitId 为 'null' 字符串或不存在时，均视为「写单条嘟嘟」模式
  const habitIdParam = (habitIdRaw && habitIdRaw !== 'null') ? Number(habitIdRaw) : null;

  chrome.storage.local.get({ sites: [], activeSiteId: null }, (data) => {
    const sites = data.sites || [];
    // 严格用 === 比较数字类型
    const site = sites.find(s => s.id === siteIdParam)
      || sites.find(s => s.id === data.activeSiteId)
      || sites[0];
    if (!site) { errorEl.textContent = '找不到站点信息'; errorEl.style.display = 'block'; return; }

    currentSite = site;
    const siteInfoEl = document.getElementById('threadSiteInfo');
    if (siteInfoEl) siteInfoEl.textContent = site.instance ? ' ' + site.instance.replace(/^https?:\/\//, '') : '';
    defaultVisibility = site.defaultVisibility || 'public';

    // 「写单条嘟嘟」模式：habitId 为 null
    if (habitIdParam === null) {
      currentHabit = null;
      textArea.value = textParam;
      newRadio.checked = true;
      idDiv.style.display = 'none';
      idInfo.style.display = 'none';
      setVisibilityDefault(defaultVisibility);

      // 单条模式下隐藏「接续串文」选项，可见性与前一条嘟无关
      if (isQuickToot) {
        const threadTypeHeading = document.getElementById('threadTypeHeading');
        if (threadTypeHeading) {
          const section = threadTypeHeading.closest('.section');
          if (section) section.style.display = 'none';
        }
        replyRadio.disabled = true;
      }

      textArea.focus();
      return;
    }

    // 话题打卡模式
    const habit = (site.habits || []).find(h => h.id === habitIdParam);
    if (!habit) { errorEl.textContent = '找不到话题'; errorEl.style.display = 'block'; return; }

    currentHabit = habit;
    textArea.value = textParam;
    errorEl.style.display = 'none';

    if (habit.root_status_id) {
      replyRadio.checked = true;
      idDiv.style.display = 'block';
      idInput.value = habit.last_status_id || habit.root_status_id;
      idInput.readOnly = false;
      idExplain.style.display = 'block';
      idInfo.textContent = '已绑定串文，即将回复给：' + (habit.last_status_id || habit.root_status_id);
      idInfo.style.display = 'block';
      getVisibilityFromServer(habit.last_status_id || habit.root_status_id);
    } else {
      newRadio.checked = true;
      idDiv.style.display = 'none';
      idInfo.style.display = 'none';
      setVisibilityOptions(defaultVisibility);
    }
    textArea.focus();
  });
}

initialize();