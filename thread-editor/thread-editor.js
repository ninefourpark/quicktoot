// thread-editor.js - Standalone window for thread editor threadIdExplain
import { LOCALES } from '../locales.js'
import { stripMentions } from '../utils.js';

// Get elements
const textArea = document.getElementById('threadModalText');
const newRadio = document.getElementById('threadNew');
const replyRadio = document.getElementById('threadReply');
const threadDiv = document.getElementById('threadIdDiv');
const idDiv = document.getElementById('threadIdDiv');
const idInput = document.getElementById('threadIdInput');
const idExplain = document.getElementById('threadIdExplain');
const idLabel = document.getElementById('threadIdLabel');
const idInfo = document.getElementById('threadIdInfo');
const visibilitySelect = document.getElementById('threadVisibility');
const visibilityLabel = document.getElementById('threadVisibilityLabel');
const errorEl = document.getElementById('threadModalError');
const publishBtn = document.getElementById('threadModalPublishBtn');
const cancelBtn = document.getElementById('threadModalCancelBtn');
const modalTitle = document.getElementById('threadModalTitle');
const threadReplyLabel = document.getElementById('threadReplyLabel');
const threadNewLabel = document.getElementById('threadNewLabel');

const imageInput = document.getElementById('threadImage');
const imageAltInput = document.getElementById('threadImageAlt');
const imageAltInputInfo = document.getElementById('imageAltInputInfo');

const toggleBtn = document.getElementById('toggleImageUpload');
const imageUploadDiv = document.getElementById('imageUploadDiv');

let currentHabit = null;
let currentLang = 'zh-cn';
let defaultVisibility = 'public';

// 语言规范化函数
function normalizeLang(lang) {
  if (!lang) return 'zh-cn';

  if (LOCALES[lang]) return lang;

  // 处理 en-us / en-gb / zh-hk 等
  const short = lang.split('-')[0];
  if (LOCALES[short]) return short;

  return 'zh-cn';
}

toggleBtn.addEventListener('click', () => {
  const isOpen = imageUploadDiv.classList.toggle('is-open');
  toggleBtn.setAttribute('aria-expanded', isOpen);
  const L = LOCALES[currentLang];
  toggleBtn.textContent = isOpen ? L.imageRemove : L.imageAdd;
});

function applyLocale(lang) {
  const normalizedLang = normalizeLang(lang);
  const L = LOCALES[normalizedLang] || LOCALES['zh-cn'];
  currentLang = lang;
  if (!L) {
      console.error('无法加载语言包:', normalizedLang);
      return;
    }

  currentLang = normalizedLang;

  modalTitle.textContent = L.threadModalTitle;
  visibilityLabel.textContent = L.threadVisibility;
  threadReplyLabel.textContent = L.threadReply;
  threadNewLabel.textContent = L.threadNew;
  idLabel.textContent = L.threadInputId;
  idExplain.textContent = L.threadIdExplain;
  idInput.placeholder = L.threadInputIdPlaceholder;
  publishBtn.textContent = L.threadPublish;
  cancelBtn.textContent = L.threadCancel;

  const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
  toggleBtn.textContent = isOpen ? L.imageRemove : L.imageAdd;
  
  imageAltInputInfo.textContent = L.imageAltInputInfo;
  threadImageAlt.placeholder = L.threadImageAlt;

  // Update visibility options
  updateVisibilityOptions(visibilitySelect.value || 'public');
}

// 清除之前的限制，讓用戶在新建串文時可以自由選擇所有公開級別
function setVisibilityIfNoContext(minVisibility) {
  const options = ['public', 'unlisted', 'private', 'direct'];
  visibilitySelect.innerHTML = '';
  const L = LOCALES[currentLang] || LOCALES['zh-cn'];
  const labels = {
    public: L.threadPublic,
    unlisted: L.threadUnlisted,
    private: L.threadPrivate,
    direct: L.threadDirect
  };
  options.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = labels[v];
    visibilitySelect.appendChild(opt);
  });
  visibilitySelect.value = minVisibility;
}


function updateVisibilityOptions(minVisibility) {
  const options = ['public', 'unlisted', 'private', 'direct'];
  const allowed = options.slice(options.indexOf(minVisibility));
  visibilitySelect.innerHTML = '';
  const L = LOCALES[currentLang] || LOCALES['zh-cn'];
  const labels = {
    public: L.threadPublic,
    unlisted: L.threadUnlisted,
    private: L.threadPrivate,
    direct: L.threadDirect
  };
  allowed.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = labels[v];
    visibilitySelect.appendChild(opt);
  });
  visibilitySelect.value = minVisibility;
}

function getVisibility(statusId) {
  chrome.storage.local.get({ instance: '' }, (data) => {
    const instance = data.instance;
    chrome.runtime.sendMessage({ action: 'getStatusVisibility', statusId: statusId, instance: instance }, (response) => {
      if (response && response.success) {
        const vis = response.visibility;
        const L = LOCALES[currentLang] || LOCALES['zh-cn'];
        const visLabels = {
          public: L.threadPublic,
          unlisted: L.threadUnlisted,
          private: L.threadPrivate,
          direct: L.threadDirect
        };
        updateVisibilityOptions(vis);
        errorEl.style.display = 'none';
      } else {
        updateVisibilityOptions('public');
        const L = LOCALES[currentLang] || LOCALES['zh-cn'];
        errorEl.textContent = L.errorGetVisibility;
        errorEl.style.display = 'block';
      }
    });
  });
}



// Event listeners
cancelBtn.onclick = () => window.close();

newRadio.onchange = () => {
  if (newRadio.checked) {
    idDiv.style.display = 'none';
    setVisibilityIfNoContext(defaultVisibility);
  }
};

replyRadio.onchange = () => {
  if (replyRadio.checked) {
    const L = LOCALES[currentLang] || LOCALES['zh-tw'];
    idDiv.style.display = 'block';
    idExplain.style.display = 'block';
    idExplain.textContent = L.threadIdExplain;

    if (currentHabit && currentHabit.root_status_id) {
      idInput.value = currentHabit.last_status_id || currentHabit.root_status_id;
      idInput.readOnly = false;

      idInfo.textContent = 
        L.threadIdInfoBound + ' ' + 
        (currentHabit.last_status_id || currentHabit.root_status_id);

      idInfo.style.display = 'block';
      getVisibility(currentHabit.last_status_id || currentHabit.root_status_id);
    } else {
      idInput.value = '';
      idInput.readOnly = false;
      idInfo.style.display = 'none';
      updateVisibilityOptions('public');
    }
  }
};

idInput.oninput = () => {
  const id = idInput.value.trim();
  if (id && replyRadio.checked) {
    idInfo.style.display = 'none';
    getVisibility(id);
  } else if (!id && replyRadio.checked) {
    updateVisibilityOptions('public');
  }
};

window.onload = () => {
  const contentHeight = document.body.scrollHeight;
  chrome.runtime.sendMessage({ action: 'resizeWindow', height: contentHeight });
};

let isKeyboardUser = false; document.addEventListener('keydown', () => { isKeyboardUser = true; }); document.addEventListener('mousedown', () => { isKeyboardUser = false; });

const selectors = ['.image-upload', '.thread-visibility', '.thread-tabs', '.thread-id-box'];

selectors.forEach(selector => { const container = document.querySelector(selector); container?.addEventListener('focusin', () => { if (isKeyboardUser) { container.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }); });


document.addEventListener('keydown', (event) => { if (event.shiftKey && event.key === 'Enter') { event.preventDefault(); publishBtn.click(); } else if (event.key === 'Escape') { event.preventDefault(); cancelBtn.click(); } });

// publish toot 
publishBtn.onclick = () => {
  const text = textArea.value.trim();
  const L = LOCALES[currentLang] || LOCALES['zh-cn'];
  const safeText = stripMentions(text); // 在发送前，阻止嘟文里出现对他人的定向提及。只要文本中匹配 @ 后面紧跟英文字母、数字或下划线，就视为提及，禁止发送。

  const file = imageInput.files[0];
  const altText = imageAltInput.value.trim();
  // 如果没写文字也没图片，显示错误并停止执行
  if (!text && !file) { 
    const L = LOCALES[currentLang] || LOCALES['zh-cn'];
    errorEl.textContent = L.errorEmptyText;
    errorEl.style.display = 'block';
    return;
  }

  // 获取用户选择的可见性（公开、私密等）
  const visibility = visibilitySelect.value;
  // 获取用户是否勾选了“回复已有串文”
  const isReply = replyRadio.checked;
  // 如果是回复模式，就拿输入框里的 ID，否则为 null（空）
  const inReplyToId = isReply ? idInput.value.trim() : null;

  // 如果选择了回复模式，但没输入ID，显示错误并停止执行
  if (isReply && !inReplyToId) {
    errorEl.textContent = L.errorEmptyId;
    errorEl.style.display = 'block';
    return;
  }

  if (!currentHabit) {
    console.error('currentHabit is null, cannot publish');
    errorEl.textContent = '无法获取当前习惯，请稍后重试';
    errorEl.style.display = 'block';
    return;
  }

  // 发送到后台
  const message = {
    action: 'publishFromContent',
    text: safeText,
    visibility,
    inReplyToId,
    habitId: currentHabit.id,
    isNewThread: !isReply,
  };

  // 判断是否存在需要上传的文件
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const arrayBuffer = e.target.result;
      // 将 ArrayBuffer 转换为普通的数字数组以确保安全传输
      message.imageBuffer = Array.from(new Uint8Array(arrayBuffer));
      message.imageName = file.name;
      message.imageType = file.type;
      message.imageAlt = altText;
      chrome.runtime.sendMessage(message, handleResponse);
    };
    reader.readAsArrayBuffer(file);
  } else {
    // 如果用户没有选择图片则会直接发送不含图像信息的消息
    chrome.runtime.sendMessage(message, handleResponse);
  }
  function handleResponse(response) {
    // response 是后台返回的结果。如果 success 为真，代表发布成功
    // 如果发布成功，更新习惯数据
    if (response && response.success) {
      // 更新习惯数据，把新嘟文的 ID 保存起来。
      // 如果用户选择了“新串”，则把新嘟文的 ID 保存到 root_status_id 和 last_status_id 里
      // 如果用户选择了“回复已有串文”，则只把新嘟文的 ID 保存到 last_status_id 里
      // 如果这是第一次绑定，则把输入的 ID 保存到 root_status_id 里
      chrome.storage.local.get({ habits: [] }, data => {
        const hlist = data.habits || [];
        // 在习惯列表里找到当前正在打卡的这一个习惯
        const idx = hlist.findIndex(h => h.id === currentHabit.id);
        if (idx !== -1) {
          if (!isReply) {
            // 如果是“新串”，那么这一条既是根 ID，也是最后一条 ID
            hlist[idx].root_status_id = response.statusId;
            hlist[idx].last_status_id = response.statusId;
          } else {
            // 如果是“回复”，根 ID 保持不变，只把最后一条 ID 更新为刚刚发布的 ID
            hlist[idx].last_status_id = response.statusId;
            // 万一之前根 ID 丢了，这里做一个补偿补录
            if (!hlist[idx].root_status_id) {
              hlist[idx].root_status_id = inReplyToId;
            }
          }
          // 将修改后的整张表重新存入浏览器本地存储
          chrome.storage.local.set({ habits: hlist }, () => {
            // 存好后，关闭这个编辑小窗口
            window.close();
          });
        }
      });
    } else {
      // 如果失败了，在界面上显示后台传回来的错误信息
      errorEl.textContent = response ? response.error : L.errorPublish;
      errorEl.style.display = 'block';
    }
  }
};

// Initialize from URL parameters or storage
function initialize() {
  const urlParams = new URLSearchParams(window.location.search);
  const habitIdParam = urlParams.get('habitId');
  const textParam = urlParams.get('text');

  chrome.storage.local.get(
    { habits: [], language: 'zh-cn', defaultVisibility: 'public', pendingThreadEditor: null }, (data) => {
    defaultVisibility = data.defaultVisibility || 'public';
    const lang = data.language || 'zh-cn';
    applyLocale(lang);

    let habitId = habitIdParam ? Number(habitIdParam) : null;
    let text = textParam ? decodeURIComponent(textParam) : '';

    if (!habitId && data.pendingThreadEditor) {
      habitId = data.pendingThreadEditor.habitId;
      text = data.pendingThreadEditor.text;
      chrome.storage.local.remove('pendingThreadEditor');
    }

    if (habitId !== null) {
      const habit = data.habits.find(h => h.id === habitId);
      if (habit) {
        currentHabit = habit;
        textArea.value = text;
        errorEl.style.display = 'none';

        if (habit.root_status_id) {
          replyRadio.checked = true;
          idDiv.style.display = 'block';
          idInput.value = habit.last_status_id || habit.root_status_id;
          idInput.readOnly = false;
          const L = LOCALES[currentLang] || LOCALES['zh-cn'];
          idExplain.textContent = L.threadIdExplain;
          idExplain.style.display = 'block';
          idInfo.textContent = L.threadIdInfoBound + ' ' + (habit.last_status_id || habit.root_status_id);
          idInfo.style.display = 'block';
          getVisibility(habit.last_status_id || habit.root_status_id);
        } else {
          newRadio.checked = true;
          idDiv.style.display = 'none';
          idInfo.style.display = 'none';
          setVisibilityIfNoContext(defaultVisibility);
        }
        textArea.focus();
      }
    }
  });
}
// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'initThreadEditor') {
    chrome.storage.local.get({ habits: [], language: 'zh-cn' }, (data) => {
      const habit = data.habits.find(h => h.id === request.habitId);
      if (habit) {
        applyLocale(data.language || 'zh-cn');
        currentHabit = habit;
        textArea.value = request.text;
        errorEl.style.display = 'none';
        
        if (habit.root_status_id) {
          replyRadio.checked = true;
          idDiv.style.display = 'block';
          idInput.value = habit.last_status_id || habit.root_status_id;
          idInput.readOnly = false;
          const L = LOCALES[currentLang] || LOCALES['zh-cn'];
          idInfo.textContent = L.threadIdInfoBound + ' ' + (habit.last_status_id || habit.root_status_id);
          idInfo.style.display = 'block';
          getVisibility(habit.last_status_id || habit.root_status_id);
        } else {
          newRadio.checked = true;
          idDiv.style.display = 'none';
          idInfo.style.display = 'none';
          updateVisibilityOptions('public');
        }
        textArea.focus();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    });
    return true;
  }
});

// Initialize on load
initialize();
