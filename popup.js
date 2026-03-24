// popup.js
import { buildHabitPostText, defaultTemplate } from './templates.js';
import { ICONS } from './icons/icons.js';
import {
  normalizeInstance, validateAndNormalizeInstance,
  calcStreak, buildHeatmap, deleteHabitById, moveHabitById,
  isHabitDoneToday, migrateToMultiSite, getSiteDisplayName, getUsedSlots
} from './scripts/habit-manager.js';
import { trapFocus, showModal, hideModal, focusModalInput } from './scripts/modal-manager.js';
import { exportBackup, exportMigration, importBackup, importMigration } from './scripts/data-import-export.js';
import {
  initKeyboardNavigation, initFocusScroll,
  initNewHabitFocusScroll, setupEnterKeySubmit
} from './scripts/keyboard-handler.js';
import { renderHabitList, hideAllHabitMenus, manageFocus, initResizeObserver } from './scripts/ui-renderer.js';

// ===== 全局状态 =====
let currentEditingHabitId = null;
let shortcutModalMode = 'habit'; // 'habit' | 'quickToot'

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  initKeyboardNavigation();
  initFocusScroll();
  initNewHabitFocusScroll();
  setupEnterKeySubmit('#newHabit', '#addHabit');
  setupEnterKeySubmit('#instanceModalInput', '#instanceSaveBtn');
  setupEnterKeySubmit('#linkModalInput', '#linkModalSaveBtn');
  setupEnterKeySubmit('#bindThreadModalInput', '#bindThreadModalSaveBtn');
  initResizeObserver();
  document.body.addEventListener('click', hideAllHabitMenus);

  setupAddHabitButton();
  setupEnableThreading();
  setupSiteSettings();
  setupGlobalSettings();
  setupDataButtons();
  setupQuickTootOptions();

  loadData();
});

// ===== 数据加载 =====
function loadData(isFromSubmit = false, lastFocusedId = null, lastFocusedClass = null) {
  chrome.storage.local.get(null, (raw) => {
    // 一次性迁移旧数据结构
    const migration = migrateToMultiSite(raw);
    if (migration) {
      chrome.storage.local.set(migration, () => {
        chrome.storage.local.get(null, (data) => render(data, isFromSubmit, lastFocusedId, lastFocusedClass));
      });
      return;
    }
    render(raw, isFromSubmit, lastFocusedId, lastFocusedClass);
  });
}

function getActiveSite(data) {
  const sites = data.sites || [];
  return sites.find(s => s.id === data.activeSiteId) || sites[0] || null;
}

function render(data, isFromSubmit = false, lastFocusedId = null, lastFocusedClass = null) {
  const sites = data.sites || [];
  const site = getActiveSite(data);

  renderSiteTabs(sites, data.activeSiteId);
  renderQuickTootBadge(site);

  if (site) {
    renderHabitList(
      site.habits || [], site, data,
      onHabitDone, onHabitUnDone, onMoveHabit, onDeleteHabit,
      startEditTitle, showBindThreadModal, showShortcutModal,
      showLinkModal, showCustomTemplateModal
    );
    updateSiteSettingsDisplay(site);
  } else {
    document.getElementById('habitList').innerHTML = '';
  }

  // 首次引导：无实例地址
  chrome.storage.local.get({ instancePromptDismissed: false }, s => {
    if (!s.instancePromptDismissed && (!site || !validateAndNormalizeInstance(site.instance))) {
      showInstanceModal();
    }
  });

  // 初次加载：焦点落在 quick-toot-row，而不是 habit 列表第一行
  if (!isFromSubmit && !lastFocusedId) {
    document.getElementById('quickTootBtn')?.focus();
    return;
  }

  manageFocus(isFromSubmit, lastFocusedId, lastFocusedClass);
}

// ===== 实例 Tab 渲染 =====
function renderSiteTabs(sites, activeSiteId) {
  const bar = document.getElementById('siteTabBar');
  bar.innerHTML = '';

  // 只有多实例时才显示 tab 栏
  bar.style.display = sites.length > 0 ? 'flex' : 'none';

  sites.forEach(site => {
    const btn = document.createElement('button');
    btn.className = 'site-tab' + (site.id === activeSiteId ? ' active' : '');
    const displayName = getSiteDisplayName(site);
    btn.textContent = displayName;
    // 如果是截断的域名，加 title 显示完整域名
    if (!site.name || !site.name.trim()) btn.title = site.instance || '';
    btn.addEventListener('click', () => {
      chrome.storage.local.set({ activeSiteId: site.id }, loadData);
    });
    bar.appendChild(btn);
  });

  // + 添加实例
  const addBtn = document.createElement('button');
  addBtn.className = 'site-tab site-tab-add';
  addBtn.textContent = '+ 添加实例';
  addBtn.addEventListener('click', () => showSiteModal(null));
  bar.appendChild(addBtn);
}

// ===== 写单条嘟嘟徽章 =====
function renderQuickTootBadge(site) {
  const badge = document.getElementById('quickTootBadge');
  const siteName = document.getElementById('quickTootSiteName');

  // 更新站点名
  if (siteName) {
    siteName.textContent = site ? `>> ${getSiteDisplayName(site)}` : '';
  }

  // 更新快捷键徽章
  if (site && site.quickTootSlot) {
    badge.innerHTML = `${ICONS.shortcutBadge} ${site.quickTootSlot}`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ===== 写单条嘟嘟按钮 =====
document.getElementById('quickTootBtn').addEventListener('click', () => {
  chrome.storage.local.get(null, (data) => {
    const site = getActiveSite(data);
    if (!site) return;
    if (!validateAndNormalizeInstance(site.instance)) { showInstanceModal(); return; }
    if (site.enableThreading) {
      chrome.runtime.sendMessage({ action: 'showThreadModalFromPopup', siteId: site.id, habitId: null, text: '' });
      window.close();
    } else {
      const inst = validateAndNormalizeInstance(site.instance);
      window.open(inst + '/share?text=');
    }
  });
});

function setupQuickTootOptions() {
  document.getElementById('quickTootOptionsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.storage.local.get(null, (data) => {
      const site = getActiveSite(data);
      if (!site) return;
      showShortcutModalForQuickToot(site, data.sites || []);
    });
  });
}

// ===== 添加习惯 =====
function setupAddHabitButton() {
  const addBtn = document.getElementById('addHabit');
  const input = document.getElementById('newHabit');
  addBtn.addEventListener('click', () => {
    const title = input.value.trim();
    if (!title) return;
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      const si = sites.findIndex(s => s.id === data.activeSiteId);
      if (si === -1) return;
      const habits = sites[si].habits || [];
      if (habits.length >= 10) return;

      // 自动分配第一个空闲快捷键槽
      const used = getUsedSlots(sites);
      let shortcutSlot = null, shortcutAction = null;
      if (habits.length < 3) {
        for (let i = 1; i <= 3; i++) {
          if (!used[i]) { shortcutSlot = i; shortcutAction = 'checkIn'; break; }
        }
      }

      habits.push({
        id: Date.now(), title, records: {},
        bestStreak: 0, totalDone: 0, link: null,
        shortcutSlot, shortcutAction, customTemplate: ''
      });
      sites[si].habits = habits;
      chrome.storage.local.set({ sites }, () => { input.value = ''; loadData(true); });
    });
  });
}

// ===== 串文开关 =====
function setupEnableThreading() {
  const cb = document.getElementById('enableThreadingInput');
  cb.addEventListener('change', () => {
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      const si = sites.findIndex(s => s.id === data.activeSiteId);
      if (si === -1) return;
      const site = sites[si];

      if (cb.checked) {
        if (!validateAndNormalizeInstance(site.instance)) {
          alert('请先填写 Mastodon 实例地址');
          cb.checked = false; return;
        }
        chrome.runtime.sendMessage({ action: 'checkToken', siteId: site.id }, async res => {
          if (!res.hasToken) {
            const r = await new Promise(resolve =>
              chrome.runtime.sendMessage({ action: 'startOAuth', siteId: site.id }, resolve)
            );
            if (r.success) {
              // OAuth 完成后 background 已将 accessToken 写入 storage。
              // 必须重新从 storage 读取，不能使用回调外层的旧 sites 对象，
              // 否则会把 accessToken: null 的旧数据覆盖回去。
              chrome.storage.local.get({ sites: [] }, fresh => {
                const freshSites = fresh.sites || [];
                const freshSi = freshSites.findIndex(s => s.id === site.id);
                if (freshSi !== -1) {
                  freshSites[freshSi].enableThreading = true;
                  chrome.storage.local.set({ sites: freshSites });
                }
              });
            } else {
              alert('授权失败：' + r.error);
              cb.checked = false;
            }
          } else {
            // 已有 token，同样重新读取后再写，避免覆盖其他并发写入
            chrome.storage.local.get({ sites: [] }, fresh => {
              const freshSites = fresh.sites || [];
              const freshSi = freshSites.findIndex(s => s.id === site.id);
              if (freshSi !== -1) {
                freshSites[freshSi].enableThreading = true;
                chrome.storage.local.set({ sites: freshSites });
              }
            });
          }
        });
      } else {
        sites[si].enableThreading = false;
        chrome.storage.local.set({ sites });
      }
    });
  });

  cb.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cb.click(); } });
}

// ===== 实例设置保存 =====
function setupSiteSettings() {
  const instanceInput = document.getElementById('instanceInput');
  const emojiDoneInput = document.getElementById('emojiDoneInput');
  const emojiEmptyInput = document.getElementById('emojiEmptyInput');
  const templateInput = document.getElementById('templateInput');
  const visibilitySelect = document.getElementById('visibilitySelect');
  const saveBtn = document.getElementById('saveSiteSettings');
  const saveWarning = document.getElementById('siteSaveWarning');
  const saveMessage = document.getElementById('siteSaveMessage');

  [document.getElementById('siteNameInput'), instanceInput, emojiDoneInput, emojiEmptyInput, templateInput].forEach(el => {
    el.addEventListener('input', () => { saveWarning.style.display = 'block'; saveMessage.style.display = 'none'; });
  });
  visibilitySelect.addEventListener('change', () => { saveWarning.style.display = 'block'; saveMessage.style.display = 'none'; });

  saveBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      const si = sites.findIndex(s => s.id === data.activeSiteId);
      if (si === -1) return;

      const oldInstance = sites[si].instance || '';
      const newInstance = normalizeInstance(instanceInput.value.trim());

      sites[si].name = document.getElementById('siteNameInput').value.trim();
      sites[si].instance = newInstance;
      sites[si].emojiDone = emojiDoneInput.value.trim() || '🔥';
      sites[si].emojiEmpty = emojiEmptyInput.value.trim() || '⬜';
      sites[si].template = templateInput.value;
      sites[si].defaultVisibility = visibilitySelect.value;

      if (newInstance !== oldInstance) {
        sites[si].accessToken = null;
        sites[si].clients = {};
        if (sites[si].enableThreading) {
          sites[si].enableThreading = false;
          document.getElementById('recheckThreadingNotice').style.display = 'block';
        }
      }

      chrome.storage.local.set({ sites }, () => {
        saveWarning.style.display = 'none';
        saveMessage.style.display = 'block';
        setTimeout(() => saveMessage.style.display = 'none', 2000);
        loadData();
      });
    });
  });

  // 删除实例
  document.getElementById('deleteSiteBtn').addEventListener('click', () => {
    if (!confirm('确定删除此实例？删除后该实例的所有话题数据都会消失。此操作无法撤销。')) return;
    chrome.storage.local.get(null, (data) => {
      let sites = data.sites || [];
      const toDelete = data.activeSiteId;
      sites = sites.filter(s => s.id !== toDelete);
      const newActiveId = sites.length > 0 ? sites[0].id : null;
      chrome.storage.local.set({ sites, activeSiteId: newActiveId }, loadData);
    });
  });
}

function updateSiteSettingsDisplay(site) {
  document.getElementById('siteNameInput').value = site.name || '';
  document.getElementById('instanceInput').value = site.instance || '';
  document.getElementById('emojiDoneInput').value = site.emojiDone || '🔥';
  document.getElementById('emojiEmptyInput').value = site.emojiEmpty || '⬜';
  document.getElementById('enableThreadingInput').checked = site.enableThreading || false;
  document.getElementById('visibilitySelect').value = site.defaultVisibility || 'public';
  // 若实例模板为空，显示默认模板
  const templateInput = document.getElementById('templateInput');
  templateInput.value = site.template === null ? defaultTemplate : site.template;
  templateInput.placeholder = defaultTemplate;
}

// ===== 全局设置 =====
function setupGlobalSettings() {
  document.getElementById('popupShortcutOpenChromeLink').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
  document.getElementById('shortcutOpenChromeLink').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
}

// ===== 数据导入导出 =====
function setupDataButtons() {
  // 实例级：备份此实例话题数据
  document.getElementById('exportSiteData').addEventListener('click', () => {
    chrome.storage.local.get({ activeSiteId: null }, d => exportBackup(d.activeSiteId));
  });

  // 实例级：恢复此实例话题数据
  const importSiteBtn = document.getElementById('importSiteBtn');
  const importSiteFile = document.getElementById('importSiteFileInput');
  importSiteBtn.addEventListener('click', () => { importSiteFile.value = ''; importSiteFile.click(); });
  importSiteFile.addEventListener('change', () => {
    chrome.storage.local.get({ activeSiteId: null }, d =>
      importBackup(importSiteFile.files[0], d.activeSiteId, loadData)
    );
  });

  // 全局：备份全部数据（不含凭证）
  document.getElementById('exportBackupAll').addEventListener('click', () => exportBackup(null));

  // 全局：导出迁移文件（含凭证，有警告）
  document.getElementById('exportMigration').addEventListener('click', exportMigration);

  // 全局：导入（自动识别备份文件 vs 迁移文件）
  const importAllBtn = document.getElementById('importAllBtn');
  const importAllFile = document.getElementById('importAllFileInput');
  importAllBtn.addEventListener('click', () => { importAllFile.value = ''; importAllFile.click(); });
  importAllFile.addEventListener('change', () => {
    const file = importAllFile.files[0];
    if (!file) return;
    // 读文件头判断是备份还是迁移文件，根据是否含凭证路由到对应函数
    const peek = new FileReader();
    peek.onload = () => {
      try {
        const parsed = JSON.parse(peek.result);
        // 兼容旧版格式（顶层含 accessToken）和新版格式（sites 数组内含 accessToken）
        const hasToken =
          (!parsed.sites && parsed.accessToken) ||
          (parsed.sites || []).some(
            s => s.accessToken || (s.clients && Object.keys(s.clients).length > 0)
          );
        if (hasToken) {
          importMigration(file, loadData);
        } else {
          importBackup(file, null, loadData);
        }
      } catch {
        importBackup(file, null, loadData); // 解析失败交给 importBackup 统一报错
      }
    };
    peek.readAsText(file);
  });
}

// ===== 添加/编辑实例 Modal =====
function showSiteModal(siteId) {
  const overlayId = 'siteModalOverlay';
  const title = document.getElementById('siteModalTitle');
  const nameInput = document.getElementById('siteModalNameInput');
  const instanceInput = document.getElementById('siteModalInstanceInput');
  const errorEl = document.getElementById('siteModalError');
  const saveBtn = document.getElementById('siteModalSaveBtn');
  const cancelBtn = document.getElementById('siteModalCancelBtn');

  errorEl.style.display = 'none';

  if (siteId) {
    title.textContent = '编辑实例';
    chrome.storage.local.get({ sites: [] }, d => {
      const site = d.sites.find(s => s.id === siteId);
      if (site) { nameInput.value = site.name || ''; instanceInput.value = site.instance || ''; }
    });
  } else {
    title.textContent = '添加实例';
    nameInput.value = '';
    instanceInput.value = '';
  }

  showModal(overlayId);
  const modal = document.getElementById('siteModal');
  trapFocus(modal);
  focusModalInput('siteModal');

  saveBtn.onclick = () => {
    const name = nameInput.value.trim();
    const raw = instanceInput.value.trim();
    const instance = normalizeInstance(raw);
    if (!raw || !validateAndNormalizeInstance(raw)) {
      errorEl.textContent = '请输入正确的实例地址，例如: mastodon.social';
      errorEl.style.display = 'block';
      return;
    }
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      if (siteId) {
        const si = sites.findIndex(s => s.id === siteId);
        if (si !== -1) { sites[si].name = name; sites[si].instance = instance; }
      } else {
        const newSite = {
          id: Date.now(), name, instance,
          enableThreading: false, defaultVisibility: 'public',
          template: null, emojiDone: '🔥', emojiEmpty: '⬜',
          habits: [], accessToken: null, clients: {}, quickTootSlot: null
        };
        sites.push(newSite);
        chrome.storage.local.set({ sites, activeSiteId: newSite.id }, () => { hideModal(overlayId); loadData(); });
        return;
      }
      chrome.storage.local.set({ sites }, () => { hideModal(overlayId); loadData(); });
    });
  };

  cancelBtn.onclick = () => hideModal(overlayId);
}

// ===== 首次引导 instance Modal =====
function showInstanceModal() {
  const overlayId = 'instanceModalOverlay';
  showModal(overlayId);
  const instanceInput = document.getElementById('instanceModalInput');
  const errorEl = document.getElementById('instanceModalError');
  const saveBtn = document.getElementById('instanceSaveBtn');
  const cancelBtn = document.getElementById('instanceCancelBtn');
  errorEl.style.display = 'none';
  instanceInput.value = '';
  const modal = document.getElementById('instanceModal');
  trapFocus(modal);
  focusModalInput('instanceModal');

  saveBtn.onclick = () => {
    const raw = instanceInput.value.trim();
    if (!raw || !validateAndNormalizeInstance(raw)) {
      errorEl.textContent = '请输入正确的地址，例如: mastodon.social';
      errorEl.style.display = 'block';
      return;
    }
    const instance = normalizeInstance(raw);
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      if (sites.length === 0) {
        const newSite = {
          id: Date.now(), name: '', instance,
          enableThreading: false, defaultVisibility: 'public',
          template: null, emojiDone: '🔥', emojiEmpty: '⬜',
          habits: [], accessToken: null, clients: {}, quickTootSlot: null
        };
        sites.push(newSite);
        chrome.storage.local.set({ sites, activeSiteId: newSite.id, instancePromptDismissed: true }, () => { hideModal(overlayId); loadData(); });
      } else {
        const si = sites.findIndex(s => s.id === data.activeSiteId);
        if (si !== -1) sites[si].instance = instance;
        chrome.storage.local.set({ sites, instancePromptDismissed: true }, () => { hideModal(overlayId); loadData(); });
      }
    });
  };

  cancelBtn.onclick = () => {
    chrome.storage.local.set({ instancePromptDismissed: true }, () => hideModal(overlayId));
  };
}

// ===== Link Modal =====
function showLinkModal(habit) {
  const overlayId = 'linkModalOverlay';
  showModal(overlayId);
  currentEditingHabitId = habit.id;
  const input = document.getElementById('linkModalInput');
  const errorEl = document.getElementById('linkModalError');
  const saveBtn = document.getElementById('linkModalSaveBtn');
  const deleteBtn = document.getElementById('linkModalDeleteBtn');
  const cancelBtn = document.getElementById('linkModalCancelBtn');
  input.value = habit.link || '';
  errorEl.style.display = 'none';
  const modal = document.getElementById('linkModal');
  trapFocus(modal);
  focusModalInput('linkModal');

  saveBtn.onclick = () => {
    const raw = input.value.trim();
    if (raw && !/^https?:\/\//i.test(raw)) {
      errorEl.textContent = '请输入以 http(s):// 开头的完整网址';
      errorEl.style.display = 'block'; return;
    }
    updateHabitField(currentEditingHabitId, 'link', raw || null, () => { hideModal(overlayId); loadData(); });
  };
  deleteBtn.onclick = () => updateHabitField(currentEditingHabitId, 'link', null, () => { hideModal(overlayId); loadData(); });
  cancelBtn.onclick = () => hideModal(overlayId);
}

// ===== Custom Template Modal =====
function showCustomTemplateModal(habit) {
  const overlayId = 'customTemplateModalOverlay';
  showModal(overlayId);
  currentEditingHabitId = habit.id;
  const input = document.getElementById('customTemplateModalInput');
  const saveBtn = document.getElementById('customTemplateModalSaveBtn');
  const deleteBtn = document.getElementById('customTemplateModalDeleteBtn');
  const cancelBtn = document.getElementById('customTemplateModalCancelBtn');
  input.value = habit.customTemplate || '';
  const modal = document.getElementById('customTemplateModal');
  trapFocus(modal);
  focusModalInput('customTemplateModal');

  saveBtn.onclick = () => {
    updateHabitField(currentEditingHabitId, 'customTemplate', input.value.trim() || null, () => { hideModal(overlayId); loadData(); });
  };
  deleteBtn.onclick = () => updateHabitField(currentEditingHabitId, 'customTemplate', null, () => { hideModal(overlayId); loadData(); });
  cancelBtn.onclick = () => hideModal(overlayId);
}

// ===== Bind Thread Modal =====
function showBindThreadModal(habit) {
  const overlayId = 'bindThreadModalOverlay';
  showModal(overlayId);
  currentEditingHabitId = habit.id;
  const input = document.getElementById('bindThreadModalInput');
  const errorEl = document.getElementById('bindThreadModalError');
  const saveBtn = document.getElementById('bindThreadModalSaveBtn');
  const removeBtn = document.getElementById('bindThreadModalRemoveBtn');
  const cancelBtn = document.getElementById('bindThreadModalCancelBtn');
  input.value = habit.root_status_id || '';
  errorEl.style.display = 'none';
  const modal = document.getElementById('bindThreadModal');
  trapFocus(modal);
  focusModalInput('bindThreadModal');

  saveBtn.onclick = () => {
    const id = input.value.trim();
    if (!id) { errorEl.textContent = '请输入嘟文编号'; errorEl.style.display = 'block'; return; }
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      const si = sites.findIndex(s => s.id === data.activeSiteId);
      if (si === -1) return;
      const hi = sites[si].habits.findIndex(h => h.id === currentEditingHabitId);
      if (hi !== -1) { sites[si].habits[hi].root_status_id = id; sites[si].habits[hi].last_status_id = id; }
      chrome.storage.local.set({ sites }, () => { hideModal(overlayId); loadData(); });
    });
  };
  removeBtn.onclick = () => {
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      const si = sites.findIndex(s => s.id === data.activeSiteId);
      if (si === -1) return;
      const hi = sites[si].habits.findIndex(h => h.id === currentEditingHabitId);
      if (hi !== -1) { delete sites[si].habits[hi].root_status_id; delete sites[si].habits[hi].last_status_id; }
      chrome.storage.local.set({ sites }, () => { hideModal(overlayId); loadData(); });
    });
  };
  cancelBtn.onclick = () => hideModal(overlayId);
}

// ===== Shortcut Modal =====
const SLOT_TO_COMMAND = { 1: 'shortcut1', 2: 'shortcut2', 3: 'shortcut3' };
const DEFAULT_SHORTCUT_TEXT = { 1: 'Ctrl + Shift + 1', 2: 'Ctrl + Shift + 2', 3: 'Ctrl + Shift + 3' };

function renderSlotOccupiedHints(slotSelect, usedSlots, excludeKey) {
  // excludeKey: 'quickToot:{siteId}' or 'habit:{habitId}' — 排除当前正在编辑的对象自身
  Array.from(slotSelect.options).forEach(opt => {
    const slot = Number(opt.value);
    if (!slot) return;
    const occupant = usedSlots[slot];
    if (occupant) {
      const isSelf = (excludeKey === `quickToot:${occupant.siteId}` && occupant.type === 'quickToot') ||
                     (excludeKey === `habit:${occupant.habitId}` && occupant.type === 'habit');
      if (!isSelf) {
        const who = occupant.type === 'quickToot'
          ? `${occupant.siteName} · 写单条嘟嘟`
          : `${occupant.siteName} · ${occupant.habitTitle}`;
        opt.textContent = `槽位 ${slot}（已被「${who}」占用）`;
      } else {
        opt.textContent = `槽位 ${slot}（默认 Ctrl + Shift + ${slot}）`;
      }
    } else {
      opt.textContent = `槽位 ${slot}（默认 Ctrl + Shift + ${slot}）`;
    }
  });
}

function updateCurrentShortcutInfo(slot) {
  const infoEl = document.getElementById('currentShortcut');
  if (!slot) { if (infoEl) infoEl.textContent = '当前快捷键：-'; return; }
  chrome.commands.getAll(commands => {
    const cmd = commands.find(c => c.name === SLOT_TO_COMMAND[slot]);
    if (infoEl) infoEl.textContent = '当前快捷键：' + (cmd && cmd.shortcut ? cmd.shortcut : DEFAULT_SHORTCUT_TEXT[slot] || '-');
  });
}

// 串文发嘟快捷键 modal
function showShortcutModal(habit) {
  shortcutModalMode = 'habit';
  const overlayId = 'shortcutModalOverlay';
  showModal(overlayId);
  currentEditingHabitId = habit.id;

  document.getElementById('shortcutModalTitle').textContent = '绑定快捷键';
  document.getElementById('shortcutModalInfo').textContent = `由于 Chrome 浏览器的限制，你最多可以设置 3 个发嘟快捷键。`;
  document.getElementById('shortcutActionRow').style.display = '';

  const slotSelect = document.getElementById('slotSelect');
  const actionSelect = document.getElementById('actionSelect');
  const errorEl = document.getElementById('shortcutModalError');
  const saveBtn = document.getElementById('shortcutModalSaveBtn');
  const clearBtn = document.getElementById('shortcutModalClearBtn');
  const cancelBtn = document.getElementById('shortcutModalCancelBtn');

  slotSelect.value = habit.shortcutSlot || '';
  actionSelect.value = habit.shortcutAction || 'checkIn';
  errorEl.style.display = 'none';

  chrome.storage.local.get({ sites: [] }, d => {
    const usedSlots = getUsedSlots(d.sites);
    renderSlotOccupiedHints(slotSelect, usedSlots, `habit:${habit.id}`);
  });

  updateCurrentShortcutInfo(habit.shortcutSlot);
  slotSelect.onchange = () => updateCurrentShortcutInfo(slotSelect.value ? Number(slotSelect.value) : null);

  const modal = document.getElementById('shortcutModal');
  trapFocus(modal);
  focusModalInput('shortcutModal');

  saveBtn.onclick = () => {
    const slot = slotSelect.value ? Number(slotSelect.value) : null;
    const action = actionSelect.value || null;
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      // 清除所有同槽位的旧绑定
      if (slot) {
        sites.forEach(s => {
          if (s.quickTootSlot === slot) s.quickTootSlot = null;
          (s.habits || []).forEach(h => { if (h.shortcutSlot === slot) { h.shortcutSlot = null; h.shortcutAction = null; } });
        });
      }
      const si = sites.findIndex(s => s.id === data.activeSiteId);
      if (si === -1) { hideModal(overlayId); return; }
      const hi = sites[si].habits.findIndex(h => h.id === currentEditingHabitId);
      if (hi !== -1) { sites[si].habits[hi].shortcutSlot = slot; sites[si].habits[hi].shortcutAction = action; }
      chrome.storage.local.set({ sites }, () => { hideModal(overlayId); loadData(); });
    });
  };
  clearBtn.onclick = () => {
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      const si = sites.findIndex(s => s.id === data.activeSiteId);
      if (si === -1) { hideModal(overlayId); return; }
      const hi = sites[si].habits.findIndex(h => h.id === currentEditingHabitId);
      if (hi !== -1) { sites[si].habits[hi].shortcutSlot = null; sites[si].habits[hi].shortcutAction = null; }
      chrome.storage.local.set({ sites }, () => { hideModal(overlayId); loadData(); });
    });
  };
  cancelBtn.onclick = () => hideModal(overlayId);
}

// 单条嘟嘟发嘟快捷键 modal
function showShortcutModalForQuickToot(site, allSites) {
  shortcutModalMode = 'quickToot';
  const overlayId = 'shortcutModalOverlay';
  showModal(overlayId);

  document.getElementById('shortcutModalTitle').textContent = `${getSiteDisplayName(site)}发嘟快捷键`;
  document.getElementById('shortcutModalInfo').textContent = `为 ${getSiteDisplayName(site)} 的「写单条嘟嘟」按钮绑定快捷键，按下后直接打开此实例的发嘟窗口。`;
  document.getElementById('shortcutActionRow').style.display = 'none';

  const slotSelect = document.getElementById('slotSelect');
  const errorEl = document.getElementById('shortcutModalError');
  const saveBtn = document.getElementById('shortcutModalSaveBtn');
  const clearBtn = document.getElementById('shortcutModalClearBtn');
  const cancelBtn = document.getElementById('shortcutModalCancelBtn');

  slotSelect.value = site.quickTootSlot || '';
  errorEl.style.display = 'none';

  const usedSlots = getUsedSlots(allSites);
  renderSlotOccupiedHints(slotSelect, usedSlots, `quickToot:${site.id}`);
  updateCurrentShortcutInfo(site.quickTootSlot);
  slotSelect.onchange = () => updateCurrentShortcutInfo(slotSelect.value ? Number(slotSelect.value) : null);

  const modal = document.getElementById('shortcutModal');
  trapFocus(modal);
  focusModalInput('shortcutModal');

  saveBtn.onclick = () => {
    const slot = slotSelect.value ? Number(slotSelect.value) : null;
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      if (slot) {
        sites.forEach(s => {
          if (s.quickTootSlot === slot) s.quickTootSlot = null;
          (s.habits || []).forEach(h => { if (h.shortcutSlot === slot) { h.shortcutSlot = null; h.shortcutAction = null; } });
        });
      }
      const si = sites.findIndex(s => s.id === site.id);
      if (si !== -1) sites[si].quickTootSlot = slot;
      chrome.storage.local.set({ sites }, () => { hideModal(overlayId); loadData(); });
    });
  };
  clearBtn.onclick = () => {
    chrome.storage.local.get(null, (data) => {
      const sites = data.sites || [];
      const si = sites.findIndex(s => s.id === site.id);
      if (si !== -1) sites[si].quickTootSlot = null;
      chrome.storage.local.set({ sites }, () => { hideModal(overlayId); loadData(); });
    });
  };
  cancelBtn.onclick = () => hideModal(overlayId);
}

// ===== Edit Title =====
function startEditTitle(habit, labelEl) {
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'edit-input';
  input.value = habit.title || ''; input.style.width = '100%';
  labelEl.replaceWith(input);
  input.focus(); input.select();

  function save() {
    const newTitle = input.value.trim();
    if (!newTitle) { input.replaceWith(labelEl); return; }
    updateHabitField(habit.id, 'title', newTitle, loadData);
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') input.replaceWith(labelEl);
  });
  input.addEventListener('blur', save);
}

// ===== 通用话题字段更新 =====
function updateHabitField(habitId, field, value, callback) {
  chrome.storage.local.get(null, (data) => {
    const sites = data.sites || [];
    const si = sites.findIndex(s => s.id === data.activeSiteId);
    if (si === -1) return;
    const hi = sites[si].habits.findIndex(h => h.id === habitId);
    if (hi !== -1) sites[si].habits[hi][field] = value;
    chrome.storage.local.set({ sites }, callback);
  });
}

// ===== 话题操作 =====
function onMoveHabit(habitId, dir, btnClass) {
  chrome.storage.local.get({ activeSiteId: null }, d => {
    moveHabitById(d.activeSiteId, habitId, dir, () => loadData(false, habitId, btnClass));
  });
}

function onDeleteHabit(habitId, title) {
  if (!confirm(`确定删除这个话题吗？删除后所有历史记录都会消失。此操作无法撤销。\n\n${title}`)) return;
  chrome.storage.local.get({ activeSiteId: null }, d => deleteHabitById(d.activeSiteId, habitId, loadData));
}

function onHabitDone(habit, focusedHabitId = null) {
  chrome.storage.local.get(null, (data) => {
    const sites = data.sites || [];
    const si = sites.findIndex(s => s.id === data.activeSiteId);
    if (si === -1) return;
    const site = sites[si];
    if (!validateAndNormalizeInstance(site.instance)) { showInstanceModal(); return; }

    const hi = sites[si].habits.findIndex(h => h.id === habit.id);
    if (hi === -1) return;
    const h = sites[si].habits[hi];

    const today = new Date().toISOString().slice(0, 10);
    h.records = h.records || {};
    h.records[today] = true;
    h.totalDone = Object.values(h.records).filter(v => v === true).length;
    const streak = calcStreak(h.records);
    if (streak > (h.bestStreak || 0)) h.bestStreak = streak;

    chrome.storage.local.set({ sites }, () => {
      const heatmap = buildHeatmap(h.records, site.emojiDone || '🔥', site.emojiEmpty || '⬜');
      const text = buildHabitPostText({
        habit: h, streak, best: h.bestStreak, total: h.totalDone, heatmap,
        siteTemplate: site.template !== undefined ? site.template : null,
        customTemplate: h.customTemplate && h.customTemplate.trim() ? h.customTemplate : null
      });

      if (site.enableThreading) {
        chrome.runtime.sendMessage({ action: 'showThreadModalFromPopup', siteId: site.id, habitId: h.id, text });
        window.close();
      } else {
        const inst = validateAndNormalizeInstance(site.instance) || 'https://example.social';
        window.open(inst + '/share?text=' + encodeURIComponent(text));
        loadData(false, focusedHabitId);
      }
    });
  });
}

function onHabitUnDone(habit, focusedHabitId = null) {
  chrome.storage.local.get(null, (data) => {
    const sites = data.sites || [];
    const si = sites.findIndex(s => s.id === data.activeSiteId);
    if (si === -1) return;
    const hi = sites[si].habits.findIndex(h => h.id === habit.id);
    if (hi === -1) return;
    const today = new Date().toISOString().slice(0, 10);
    sites[si].habits[hi].records = sites[si].habits[hi].records || {};
    delete sites[si].habits[hi].records[today];
    chrome.storage.local.set({ sites }, () => loadData(false, focusedHabitId));
  });
}