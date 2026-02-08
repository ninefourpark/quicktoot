// Debug logging
console.log('popup.js loading...');

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  alert('Error: ' + event.error.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  alert('Unhandled rejection: ' + event.reason);
});

// Import modules
import { getTemplate, buildHabitPostText } from './templates.js';
import { LOCALES } from './locales.js';
import { ICONS } from './icons/icons.js';
import {
  getCurrentLang,
  setActiveLangButton,
  normalizeLang,
  applyLocale
} from './scripts/locale-manager.js';
import {
  normalizeInstance,
  validateAndNormalizeInstance,
  calcStreak,
  buildHeatmap,
  deleteHabitById,
  moveHabitById,
  isHabitDoneToday
} from './scripts/habit-manager.js';
import {
  trapFocus,
  showModal,
  hideModal,
  focusModalInput
} from './scripts/modal-manager.js';
import {
  exportData,
  importData
} from './scripts/data-import-export.js';
import {
  initKeyboardNavigation,
  initFocusScroll,
  initNewHabitFocusScroll,
  setupEnterKeySubmit
} from './scripts/keyboard-handler.js';
import {
  renderHabitList,
  hideAllHabitMenus,
  manageFocus,
  updateWindowHeight,
  initResizeObserver,
  updateSettingsDisplay
} from './scripts/ui-renderer.js';

console.log('All modules imported successfully');

// Global state
let currentEditingHabitId = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded triggered, initializing...');
  try {
    initializeUI();
    loadData();
    console.log('Initialization completed successfully');
  } catch (error) {
    console.error('Initialization failed:', error);
    alert('Initialization failed: ' + error.message);
  }
});

function initializeUI() {
  console.log('initializeUI started');
  
  try {
    // Keyboard navigation
    initKeyboardNavigation();
    console.log('- initKeyboardNavigation done');
    
    initFocusScroll();
    console.log('- initFocusScroll done');
    
    initNewHabitFocusScroll();
    console.log('- initNewHabitFocusScroll done');

    // Enter key submit
    setupEnterKeySubmit('#newHabit', '#addHabit');
    setupEnterKeySubmit('#instanceModalInput', '#instanceSaveBtn');
    setupEnterKeySubmit('#linkModalInput', '#linkModalSaveBtn');
    setupEnterKeySubmit('#bindThreadModalInput', '#bindThreadModalSaveBtn');
    console.log('- setupEnterKeySubmit done');

    // Window height
    initResizeObserver();
    console.log('- initResizeObserver done');

    // Menu close
    document.body.addEventListener('click', hideAllHabitMenus);
    console.log('- menu close listener added');

    // Language buttons
    setupLanguageButtons();
    console.log('- setupLanguageButtons done');

    // Add habit
    setupAddHabitButton();
    console.log('- setupAddHabitButton done');

    // Enable threading
    setupEnableThreading();
    console.log('- setupEnableThreading done');

    // Settings input
    setupSettingsInputs();
    console.log('- setupSettingsInputs done');

    // Data import export
    setupDataExportImport();
    console.log('- setupDataExportImport done');
    
    console.log('initializeUI finished successfully');
  } catch (error) {
    console.error('Error in initializeUI:', error);
    throw error;
  }
}

// ============== Language Management ==============
function setupLanguageButtons() {
  const langButtons = document.querySelectorAll('.langBtn');
  if (!langButtons || !langButtons.length) return;

  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      chrome.storage.local.get({ templates: {} }, data => {
        const templates = data.templates || {};
        chrome.storage.local.set({ language: lang }, () => {
          applyLocale(lang, templates);
          loadData();
        });
      });
    });
  });
}

// ============== Data Loading ==============
function loadData(isFromSubmit = false, lastFocusedId = null, lastFocusedClass = null) {
  chrome.storage.local.get(
    {
      habits: [],
      emojiDone: '🔥',
      emojiEmpty: '⬜',
      instance: '',
      language: 'zh-cn',
      templates: {},
      enableThreading: false,
      defaultVisibility: 'public'
    },
    (data) => {
      data.language = normalizeLang(data.language);
      render(data, isFromSubmit, lastFocusedId, lastFocusedClass);
    }
  );
}

function render(data, isFromSubmit = false, lastFocusedId = null, lastFocusedClass = null) {
  // Update settings display
  updateSettingsDisplay(data);

  // Render habit list
  renderHabitList(
    data.habits,
    data,
    onHabitDone,
    onHabitUnDone,
    onMoveHabit,
    onDeleteHabit,
    startEditTitle,
    showBindThreadModal,
    showShortcutModal,
    showLinkModal,
    showCustomTemplateModal
  );

  // Apply localization
  applyLocale(data.language, data.templates);

  // Check pending thread habit
  chrome.storage.local.get({ pendingThreadHabit: null, pendingText: null }, pendingData => {
    if (pendingData.pendingThreadHabit) {
      const habit = data.habits.find(h => h.id === pendingData.pendingThreadHabit);
      if (habit && pendingData.pendingText) {
        chrome.storage.local.remove(['pendingThreadHabit', 'pendingText'], () => {
          showThreadModal(habit, pendingData.pendingText, data);
        });
      } else {
        chrome.storage.local.remove(['pendingThreadHabit', 'pendingText']);
      }
    }
  });

  // Check if instance is valid
  chrome.storage.local.get({ instancePromptDismissed: false }, s => {
    if (!s.instancePromptDismissed && !validateAndNormalizeInstance(data.instance)) {
      showInstanceModal(data.language || getCurrentLang() || 'zh-cn', data.instance);
    }
  });

  // Focus management
  manageFocus(isFromSubmit, lastFocusedId, lastFocusedClass);
}

// ============== Add Habit ==============
function setupAddHabitButton() {
  const addHabitBtn = document.getElementById('addHabit');
  const newHabitEl = document.getElementById('newHabit');

  addHabitBtn.addEventListener('click', () => {
    const title = newHabitEl.value.trim();
    if (!title) return;

    chrome.storage.local.get({ habits: [] }, data => {
      if (data.habits.length >= 10) return;

      let shortcutSlot = null;
      let shortcutAction = null;
      if (data.habits.length < 3) {
        const usedSlots = data.habits.map(h => h.shortcutSlot).filter(s => s);
        for (let i = 1; i <= 3; i++) {
          if (!usedSlots.includes(i)) {
            shortcutSlot = i;
            shortcutAction = 'checkIn';
            break;
          }
        }
      }

      data.habits.push({
        id: Date.now(),
        title,
        records: {},
        bestStreak: 0,
        totalDone: 0,
        link: null,
        shortcutSlot,
        shortcutAction,
        customTemplate: ''
      });

      chrome.storage.local.set({ habits: data.habits }, () => {
        newHabitEl.value = '';
        loadData(true);
      });
    });
  });
}

// ============== Enable Threading ==============
function setupEnableThreading() {
  const enableThreadingInput = document.getElementById('enableThreadingInput');

  enableThreadingInput.addEventListener('change', () => {
    const instanceInput = document.getElementById('instanceInput');
    const instance = instanceInput.value.trim();
    const lang = getCurrentLang();
    const L = LOCALES[lang] || LOCALES['zh-cn'];

    if (enableThreadingInput.checked) {
      if (!instance) {
        alert(L.alertInstanceRequired);
        enableThreadingInput.checked = false;
        return;
      }

      chrome.runtime.sendMessage({ action: 'checkToken' }, async response => {
        if (!response.hasToken) {
          const res = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'startOAuth', instance: instance }, resolve);
          });
          if (res.success) {
            await chrome.storage.local.set({ enableThreading: enableThreadingInput.checked });
          } else {
            alert(L.alertEnableThreadingError + res.error);
            enableThreadingInput.checked = false;
          }
        } else {
          await chrome.storage.local.set({ enableThreading: enableThreadingInput.checked });
        }
      });
    } else {
      chrome.storage.local.set({ enableThreading: false });
    }
  });

  enableThreadingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enableThreadingInput.click();
    }
  });
}

// ============== Settings Save ==============
function setupSettingsInputs() {
  const instanceInput = document.getElementById('instanceInput');
  const emojiDoneInput = document.getElementById('emojiDoneInput');
  const emojiEmptyInput = document.getElementById('emojiEmptyInput');
  const templateInput = document.getElementById('templateInput');
  const visibilitySelect = document.getElementById('visibilitySelect');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const saveWarning = document.getElementById('saveWarning');
  const saveMessage = document.getElementById('saveMessage');

  const inputs = [instanceInput, emojiDoneInput, emojiEmptyInput, templateInput];
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      saveWarning.style.display = 'block';
      saveMessage.style.display = 'none';
    });
  });

  visibilitySelect.addEventListener('change', () => {
    saveWarning.style.display = 'block';
    saveMessage.style.display = 'none';
  });

  saveSettingsBtn.addEventListener('click', () => {
    const instance = instanceInput.value.trim();
    const emojiDone = emojiDoneInput.value.trim();
    const emojiEmpty = emojiEmptyInput.value.trim();
    const enableThreading = document.getElementById('enableThreadingInput').checked;
    const template = templateInput.value;
    const visibility = visibilitySelect.value;

    chrome.storage.local.get({ language: 'zh-cn', templates: {}, instance: '' }, data => {
      const templates = data.templates || {};
      const lang = data.language || 'zh-cn';
      const oldInstance = data.instance || '';

      templates[lang] = templateInput.value;

      const settingsToSet = {
        instance: instance,
        emojiDone: emojiDone || '🔥',
        emojiEmpty: emojiEmpty || '⬜',
        enableThreading: enableThreading,
        templates: templates,
        language: data.language,
        defaultVisibility: visibility
      };

      if (instance !== oldInstance) {
        settingsToSet.accessToken = null;
        if (document.getElementById('enableThreadingInput').checked) {
          settingsToSet.enableThreading = false;
          const recheckThreadingNotice = document.getElementById('recheckThreadingNotice');
          recheckThreadingNotice.style.display = 'block';
        }
      }

      chrome.storage.local.set(settingsToSet, () => {
        loadData();
        const recheckThreadingNotice = document.getElementById('recheckThreadingNotice');
        recheckThreadingNotice.style.display = 'block';

        saveWarning.style.display = 'none';
        saveMessage.style.display = 'block';
        setTimeout(() => {
          saveMessage.style.display = 'none';
        }, 2000);
      });
    });
  });
}

// ============== Data Export/Import ==============
function setupDataExportImport() {
  const exportDataBtn = document.getElementById('exportData');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFileInput');

  exportDataBtn.addEventListener('click', exportData);

  importBtn.addEventListener('click', () => {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files[0];
    importData(file, () => loadData());
  });
}

// ============== Instance Modal ==============
function showInstanceModal(lang, currentInstance) {
  const overlayId = 'instanceModalOverlay';
  showModal(overlayId);

  const L = LOCALES[lang] || LOCALES['zh-cn'];
  const instanceModalTitle = document.getElementById('instanceModalTitle');
  const instanceModalMessage = document.getElementById('instanceModalMessage');
  const instanceModalInput = document.getElementById('instanceModalInput');
  const instanceModalError = document.getElementById('instanceModalError');
  const instanceSaveBtn = document.getElementById('instanceSaveBtn');
  const instanceCancelBtn = document.getElementById('instanceCancelBtn');

  if (instanceModalTitle) instanceModalTitle.textContent = L.instanceModalTitle;
  if (instanceModalMessage) instanceModalMessage.textContent = L.instanceModalMessage;
  if (instanceModalInput) instanceModalInput.placeholder = L.instancePlaceholder;
  if (instanceModalError) instanceModalError.style.display = 'none';

  if (instanceModalInput) {
    instanceModalInput.value = currentInstance && currentInstance !== 'https://example.social' ? currentInstance : '';
  }

  const modal = document.getElementById('instanceModal');
  modal.classList.add('open');
  trapFocus(modal);
  focusModalInput('instanceModal');

  instanceSaveBtn.onclick = () => {
    const raw = instanceModalInput.value.trim();
    const val = normalizeInstance(raw);
    const lang = getCurrentLang() || 'zh-cn';
    const L = LOCALES[lang] || LOCALES['zh-cn'];

    if (!raw || !validateAndNormalizeInstance(raw)) {
      instanceModalError.textContent = L.instanceInvalid || 'Please enter a valid address';
      instanceModalError.style.display = 'block';
      return;
    }

    chrome.storage.local.set({ instance: val, instancePromptDismissed: false }, () => {
      document.getElementById('instanceInput').value = val;
      hideModal(overlayId);
      loadData();
    });
  };

  instanceCancelBtn.onclick = () => {
    chrome.storage.local.set({ instancePromptDismissed: true }, () => hideModal(overlayId));
  };
}

// ============== Link Modal ==============
function showLinkModal(habit) {
  const overlayId = 'linkModalOverlay';
  showModal(overlayId);

  currentEditingHabitId = habit.id;
  const linkModalInput = document.getElementById('linkModalInput');
  const linkModalError = document.getElementById('linkModalError');
  const linkModalSaveBtn = document.getElementById('linkModalSaveBtn');
  const linkModalDeleteBtn = document.getElementById('linkModalDeleteBtn');
  const linkModalCancelBtn = document.getElementById('linkModalCancelBtn');

  if (linkModalInput) {
    linkModalInput.value = habit.link || '';
    linkModalInput.focus();
  }
  if (linkModalError) linkModalError.style.display = 'none';

  const modal = document.getElementById('linkModal');
  modal.classList.add('open');
  trapFocus(modal);
  focusModalInput('linkModal');

  linkModalSaveBtn.onclick = () => {
    const raw = linkModalInput.value.trim();
    if (raw && !/^https?:\/\//i.test(raw)) {
      linkModalError.textContent = 'Please enter a valid URL starting with http(s)://';
      linkModalError.style.display = 'block';
      return;
    }

    chrome.storage.local.get({ habits: [] }, data => {
      const h = data.habits || [];
      const i = h.findIndex(x => x.id === currentEditingHabitId);
      if (i === -1) {
        hideModal(overlayId);
        return;
      }
      h[i].link = raw || null;
      chrome.storage.local.set({ habits: h }, () => {
        hideModal(overlayId);
        loadData();
      });
    });
  };

  linkModalDeleteBtn.onclick = () => {
    chrome.storage.local.get({ habits: [] }, data => {
      const h = data.habits || [];
      const i = h.findIndex(x => x.id === currentEditingHabitId);
      if (i === -1) {
        hideModal(overlayId);
        return;
      }
      h[i].link = null;
      chrome.storage.local.set({ habits: h }, () => {
        hideModal(overlayId);
        loadData();
      });
    });
  };

  linkModalCancelBtn.onclick = () => hideModal(overlayId);
}

// ============== Custom Template Modal ==============
function showCustomTemplateModal(habit) {
  const overlayId = 'customTemplateModalOverlay';
  showModal(overlayId);

  currentEditingHabitId = habit.id;
  const customTemplateModalInput = document.getElementById('customTemplateModalInput');
  const customTemplateModalSaveBtn = document.getElementById('customTemplateModalSaveBtn');
  const customTemplateModalDeleteBtn = document.getElementById('customTemplateModalDeleteBtn');
  const customTemplateModalCancelBtn = document.getElementById('customTemplateModalCancelBtn');

  if (customTemplateModalInput) {
    customTemplateModalInput.value = habit.customTemplate || '';
    customTemplateModalInput.focus();
  }

  const modal = document.getElementById('customTemplateModal');
  modal.classList.add('open');
  trapFocus(modal);
  focusModalInput('customTemplateModal');

  customTemplateModalSaveBtn.onclick = () => {
    const customTemplate = customTemplateModalInput.value.trim();

    chrome.storage.local.get({ habits: [] }, data => {
      const habits = data.habits || [];
      const index = habits.findIndex(h => h.id === currentEditingHabitId);
      if (index === -1) {
        hideModal(overlayId);
        return;
      }

      habits[index].customTemplate = customTemplate || null;
      chrome.storage.local.set({ habits }, () => {
        hideModal(overlayId);
        loadData();
      });
    });
  };

  customTemplateModalDeleteBtn.onclick = () => {
    chrome.storage.local.get({ habits: [] }, data => {
      const h = data.habits || [];
      const i = h.findIndex(x => x.id === currentEditingHabitId);
      if (i === -1) {
        hideModal(overlayId);
        return;
      }
      h[i].customTemplate = null;
      chrome.storage.local.set({ habits: h }, () => {
        hideModal(overlayId);
        loadData();
      });
    });
  };

  customTemplateModalCancelBtn.onclick = () => hideModal(overlayId);
}

// ============== Bind Thread Modal ==============
function showBindThreadModal(habit) {
  const modal = document.getElementById('bindThreadModal');
  const overlayId = 'bindThreadModalOverlay';
  showModal(overlayId);

  const input = document.getElementById('bindThreadModalInput');
  const errorEl = document.getElementById('bindThreadModalError');
  const saveBtn = document.getElementById('bindThreadModalSaveBtn');
  const removeBtn = document.getElementById('bindThreadModalRemoveBtn');
  const cancelBtn = document.getElementById('bindThreadModalCancelBtn');

  const lang = getCurrentLang();
  const L = LOCALES[lang] || LOCALES['zh-cn'];

  document.getElementById('bindThreadModalTitle').textContent = L.bindThreadModalTitle;
  document.getElementById('bindThreadModalInfo').innerHTML = L.bindThreadInfo;
  input.placeholder = L.bindThreadPlaceholder;
  saveBtn.textContent = L.bindThreadSave;
  removeBtn.textContent = L.bindThreadRemove;
  cancelBtn.textContent = L.cancelBtn;

  if (input) {
    input.value = habit.root_status_id || '';
    input.focus();
  }
  if (errorEl) errorEl.style.display = 'none';

  modal.classList.add('open');
  trapFocus(modal);
  focusModalInput('bindThreadModal');

  saveBtn.onclick = () => {
    const id = input.value.trim();
    if (!id) {
      errorEl.textContent = 'Please enter a toot ID';
      errorEl.style.display = 'block';
      return;
    }
    chrome.storage.local.get({ habits: [] }, data => {
      const hlist = data.habits || [];
      const idx = hlist.findIndex(h => h.id === habit.id);
      if (idx !== -1) {
        hlist[idx].root_status_id = id;
        hlist[idx].last_status_id = id;
        chrome.storage.local.set({ habits: hlist }, () => {
          hideModal(overlayId);
          loadData();
        });
      }
    });
  };

  removeBtn.onclick = () => {
    chrome.storage.local.get({ habits: [] }, data => {
      const hlist = data.habits || [];
      const idx = hlist.findIndex(h => h.id === habit.id);
      if (idx !== -1) {
        delete hlist[idx].root_status_id;
        delete hlist[idx].last_status_id;
        chrome.storage.local.set({ habits: hlist }, () => {
          hideModal(overlayId);
          loadData();
        });
      }
    });
  };

  cancelBtn.onclick = () => hideModal(overlayId);
}

// ============== Shortcut Modal ==============
const SLOT_TO_COMMAND = {
  1: 'shortcut1',
  2: 'shortcut2',
  3: 'shortcut3'
};

const DEFAULT_SHORTCUT_TEXT = {
  1: 'Ctrl + Shift + 1',
  2: 'Ctrl + Shift + 2',
  3: 'Ctrl + Shift + 3'
};

function updateCurrentShortcutInfo(slot) {
  const lang = getCurrentLang();
  const L = LOCALES[lang] || LOCALES['zh-cn'];
  const infoEl = document.getElementById('currentShortcut');

  if (!slot) {
    if (infoEl) infoEl.textContent = L.shortcutCurrentInfo + '-';
    return;
  }

  const commandName = SLOT_TO_COMMAND[slot];

  chrome.commands.getAll(commands => {
    const cmd = commands.find(c => c.name === commandName);

    if (cmd && cmd.shortcut) {
      if (infoEl) infoEl.textContent = L.shortcutCurrentInfo + cmd.shortcut;
    } else if (DEFAULT_SHORTCUT_TEXT[slot]) {
      if (infoEl) infoEl.textContent = L.shortcutCurrentInfo + DEFAULT_SHORTCUT_TEXT[slot];
    } else {
      if (infoEl) infoEl.textContent = L.shortcutCurrentInfo + '-';
    }
  });
}

function showShortcutModal(habit) {
  const overlayId = 'shortcutModalOverlay';
  showModal(overlayId);

  currentEditingHabitId = habit.id;
  const slotSelect = document.getElementById('slotSelect');
  const actionSelect = document.getElementById('actionSelect');
  const shortcutModalError = document.getElementById('shortcutModalError');
  const shortcutModalSaveBtn = document.getElementById('shortcutModalSaveBtn');
  const shortcutModalClearBtn = document.getElementById('shortcutModalClearBtn');
  const shortcutModalCancelBtn = document.getElementById('shortcutModalCancelBtn');

  if (slotSelect) slotSelect.value = habit.shortcutSlot || '';
  if (actionSelect) actionSelect.value = habit.shortcutAction || 'checkIn';
  if (shortcutModalError) shortcutModalError.style.display = 'none';

  const modal = document.getElementById('shortcutModal');
  modal.classList.add('open');
  trapFocus(modal);

  updateCurrentShortcutInfo(habit.shortcutSlot);
  if (slotSelect) {
    slotSelect.addEventListener('change', () => {
      const slot = slotSelect.value ? Number(slotSelect.value) : null;
      updateCurrentShortcutInfo(slot);
    });
  }

  focusModalInput('shortcutModal');

  shortcutModalSaveBtn.onclick = () => {
    const slot = slotSelect.value ? Number(slotSelect.value) : null;
    const action = actionSelect.value || null;

    chrome.storage.local.get({ habits: [] }, data => {
      const h = data.habits || [];

      if (slot) {
        h.forEach(x => { if (x.shortcutSlot === slot) { x.shortcutSlot = null; x.shortcutAction = null; } });
      }

      const i = h.findIndex(x => x.id === currentEditingHabitId);
      if (i === -1) {
        hideModal(overlayId);
        return;
      }

      h[i].shortcutSlot = slot;
      h[i].shortcutAction = action;

      chrome.storage.local.set({ habits: h }, () => {
        hideModal(overlayId);
        loadData();
      });
    });
  };

  shortcutModalClearBtn.onclick = () => {
    chrome.storage.local.get({ habits: [] }, data => {
      const h = data.habits || [];
      const i = h.findIndex(x => x.id === currentEditingHabitId);
      if (i === -1) {
        hideModal(overlayId);
        return;
      }
      h[i].shortcutSlot = null;
      h[i].shortcutAction = null;
      chrome.storage.local.set({ habits: h }, () => {
        hideModal(overlayId);
        loadData();
      });
    });
  };

  shortcutModalCancelBtn.onclick = () => hideModal(overlayId);
}

// ============== Thread Modal ==============
function showThreadModal(habit, text, data) {
  const url = chrome.runtime.getURL(`thread-editor/thread-editor.html?habitId=${habit.id}&text=${encodeURIComponent(text)}`);
  chrome.windows.create({
    url: url,
    type: 'popup',
    width: 460,
    height: 560,
    focused: true
  }, (createdWindow) => {
    if (chrome.runtime.lastError) {
      const lang = getCurrentLang() || 'zh-cn';
      const L = LOCALES[lang] || LOCALES['zh-cn'];
      alert(L.errorPublish || 'Failed to show editor window, please try again.');
      console.error('Failed to create window:', chrome.runtime.lastError);
      return;
    }
    if (createdWindow) {
      window.close();
    } else {
      const lang = getCurrentLang() || 'zh-cn';
      const L = LOCALES[lang] || LOCALES['zh-cn'];
      alert(L.errorPublish || 'Failed to show editor window, please try again.');
    }
  });
}

// ============== Edit Title ==============
function startEditTitle(habit, labelEl, idx) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = habit.title || '';
  input.style.width = '100%';

  labelEl.replaceWith(input);
  input.focus();
  input.select();

  function save() {
    const newTitle = input.value.trim();
    if (!newTitle) {
      input.replaceWith(labelEl);
      return;
    }
    chrome.storage.local.get({ habits: [] }, data => {
      const h = data.habits || [];
      const i = h.findIndex(x => x.id === habit.id);
      if (i === -1) {
        input.replaceWith(labelEl);
        return;
      }
      h[i].title = newTitle;
      chrome.storage.local.set({ habits: h }, () => { loadData(); });
    });
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      input.replaceWith(labelEl);
    }
  });
  input.addEventListener('blur', () => save());
}

// ============== Habit Operations ==============
function onMoveHabit(id, dir, btnClass) {
  moveHabitById(id, dir, () => {
    loadData(false, id, btnClass);
  });
}

function onDeleteHabit(id, title) {
  const lang = getCurrentLang() || 'zh-cn';
  const msg = (LOCALES[lang] && LOCALES[lang].confirmDelete) || LOCALES['zh-cn'].confirmDelete;
  if (!confirm(`${msg}\n\n${title}`)) return;

  deleteHabitById(id, loadData);
}

function onHabitDone(habit, focusedHabitId = null) {
  chrome.storage.local.get(
    {
      habits: [],
      emojiDone: '🔥',
      emojiEmpty: '⬜',
      instance: '',
      language: 'zh-cn',
      templates: {},
      enableThreading: false
    },
    data => {
      const hlist = data.habits || [];
      const idx = hlist.findIndex(h => h.id === habit.id);
      if (idx === -1) return;

      const h = hlist[idx];

      if (!validateAndNormalizeInstance(data.instance)) {
        showInstanceModal(data.language || getCurrentLang() || 'zh-cn', data.instance);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      h.records = h.records || {};
      h.records[today] = true;

      const totalDone = Object.values(h.records).filter(v => v === true).length;
      h.totalDone = totalDone;

      const streak = calcStreak(h.records);
      if (streak > h.bestStreak) {
        h.bestStreak = streak;
      }

      chrome.storage.local.set({ habits: hlist }, () => {
        const heatmap = buildHeatmap(h.records, data.emojiDone, data.emojiEmpty);

        const templateToUse = h.customTemplate && h.customTemplate.trim()
          ? h.customTemplate
          : null;

        const text = buildHabitPostText({
          habit: h,
          streak,
          best: h.bestStreak,
          total: h.totalDone,
          heatmap,
          emojiDone: data.emojiDone || '🔥',
          emojiEmpty: data.emojiEmpty || '⬜',
          lang: data.language || 'zh-cn',
          userTemplates: data.templates || {},
          customTemplate: templateToUse,
        });

        if (data.enableThreading) {
          showThreadModal(h, text, data);
        } else {
          const inst = validateAndNormalizeInstance(data.instance) || 'https://example.social';
          const url = inst + '/share?text=' + encodeURIComponent(text);
          window.open(url);
          loadData(false, focusedHabitId);
        }
      });
    }
  );
}

function onHabitUnDone(habit, focusedHabitId = null) {
  chrome.storage.local.get({ habits: [] }, data => {
    const hlist = data.habits || [];
    const idx = hlist.findIndex(h => h.id === habit.id);
    if (idx === -1) return;

    const h = hlist[idx];
    const today = new Date().toISOString().slice(0, 10);
    h.records = h.records || {};
    delete h.records[today];

    chrome.storage.local.set({ habits: hlist }, () => {
      loadData(false, focusedHabitId);
    });
  });
}
