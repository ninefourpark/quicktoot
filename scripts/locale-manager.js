import { LOCALES } from '../locales.js';
import { ICONS } from '../icons/icons.js';
import { getTemplate } from '../templates.js';

/**
 * 获取当前最新的语言设置
 */
export function getCurrentLang() {
  const b = document.querySelector('.langBtn.active');
  if (b && b.dataset && b.dataset.lang) return b.dataset.lang;
  return 'zh-cn';
}

/**
 * 设置活跃的语言按钮
 */
export function setActiveLangButton(lang) {
  document.querySelectorAll('.langBtn').forEach(btn => {
    if (btn.dataset.lang === lang) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

/**
 * 语言规范化函数
 */
export function normalizeLang(lang) {
  if (!lang) return 'zh-cn';
  if (LOCALES[lang]) return lang;
  const short = lang.split('-')[0];
  if (LOCALES[short]) return short;
  return 'zh-cn';
}

/**
 * 应用语言设置到界面
 */
export function applyLocale(lang, templates) {
  const normalizedLang = normalizeLang(lang);
  const L = LOCALES[normalizedLang];

  document.documentElement.lang = L.langAttr;

  // 更新主界面文本
  const titleHabitsEl = document.getElementById('titleHabits');
  const settingsHeadingEl = document.getElementById('settingsHeading');
  const githublink = document.getElementById('githublink');
  const labelInstanceEl = document.getElementById('labelInstance');
  const labelEmojiDoneEl = document.getElementById('labelEmojiDone');
  const labelEmojiEmptyEl = document.getElementById('labelEmojiEmpty');
  const labelEnableThreadingEl = document.getElementById('labelEnableThreading');
  const labelLanguageEl = document.getElementById('labelLanguage');
  const labelTemplateEl = document.getElementById('labelTemplate');
  const explainTemplateEl = document.getElementById('explainTemplate');
  const explainEnableThreadingEl = document.getElementById('explainEnableThreading');
  const templateInput = document.getElementById('templateInput');
  const legendEl = document.getElementById('popupShortcutLegend');
  const infoEl = document.getElementById('popupShortcutInfo');
  const btnEl = document.getElementById('popupShortcutOpenChromeLink');
  const newHabitEl = document.getElementById('newHabit');
  const instanceInput = document.getElementById('instanceInput');
  const addHabitBtn = document.getElementById('addHabit');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const exportDataBtn = document.getElementById('exportData');
  const importTitle = document.getElementById('importTitle');
  const importDesc = document.getElementById('importDesc');
  const importBtn = document.getElementById('importBtn');
  const recheckThreadingNoticeEl = document.getElementById('recheckThreadingNotice');
  const saveMessageEl = document.getElementById('saveMessage');
  const saveWarningEl = document.getElementById('saveWarning');
  const labelVisibilityEl = document.getElementById('labelVisibility');
  const explainVisibilityEl = document.getElementById('explainVisibility');
  const visibilitySelectEl = document.getElementById('visibilitySelect');

  if (titleHabitsEl) titleHabitsEl.textContent = L.titleHabits;
  if (settingsHeadingEl) settingsHeadingEl.textContent = L.settingsHeading;
  if (githublink) githublink.innerHTML = L.githublink;
  if (labelInstanceEl) labelInstanceEl.textContent = L.labelInstance;
  if (labelEmojiDoneEl) labelEmojiDoneEl.textContent = L.labelEmojiDone;
  if (labelEmojiEmptyEl) labelEmojiEmptyEl.textContent = L.labelEmojiEmpty;
  if (labelEnableThreadingEl) labelEnableThreadingEl.textContent = L.enableThreading;
  if (explainEnableThreadingEl) explainEnableThreadingEl.textContent = L.explainEnableThreading;
  if (labelLanguageEl) labelLanguageEl.textContent = L.labelLanguage;
  if (labelTemplateEl) labelTemplateEl.textContent = L.labelTemplate;
  if (explainTemplateEl) explainTemplateEl.textContent = L.explainTemplate;

  if (legendEl) legendEl.textContent = L.popupShortcutLegend;
  if (infoEl) infoEl.textContent = L.popupShortcutInfo;
  if (btnEl) {
    btnEl.textContent = L.popupShortcutOpenChromeLink;
    btnEl.setAttribute('aria-label', L.popupShortcutOpenChromeLinkAria);
  }

  if (newHabitEl) newHabitEl.placeholder = L.newHabitPlaceholder;
  if (instanceInput) instanceInput.placeholder = L.instancePlaceholder;

  if (addHabitBtn) addHabitBtn.textContent = L.addButton;
  if (saveSettingsBtn) saveSettingsBtn.textContent = L.saveSettings;
  if (exportDataBtn) exportDataBtn.textContent = L.exportData;
  if (importTitle) importTitle.textContent = L.importTitle;
  if (importDesc) importDesc.textContent = L.importDesc;
  if (importBtn) importBtn.textContent = L.importBtn;

  if (labelVisibilityEl) labelVisibilityEl.textContent = L.labelVisibility;
  if (explainVisibilityEl) explainVisibilityEl.innerHTML = L.explainVisibility;
  if (visibilitySelectEl) {
    if (visibilitySelectEl.options[0]) visibilitySelectEl.options[0].textContent = L.visibilityPublic;
    if (visibilitySelectEl.options[1]) visibilitySelectEl.options[1].textContent = L.visibilityUnlisted;
    if (visibilitySelectEl.options[2]) visibilitySelectEl.options[2].textContent = L.visibilityPrivate;
    if (visibilitySelectEl.options[3]) visibilitySelectEl.options[3].textContent = L.visibilityDirect;
  }

  if (recheckThreadingNoticeEl) recheckThreadingNoticeEl.textContent = L.recheckThreadingNotice;
  if (saveMessageEl) saveMessageEl.textContent = L.saveMessage;
  if (saveWarningEl) saveWarningEl.textContent = L.saveWarning;

  setActiveLangButton(lang);

  const t = getTemplate(lang, templates);
  if (templateInput) templateInput.value = t;

  // instance modal localization
  updateInstanceModalLocale(L);

  // link modal localization
  updateLinkModalLocale(L);

  // custom template modal localization
  updateCustomTemplateModalLocale(L);

  // shortcut modal localization
  updateShortcutModalLocale(L);
}

function updateInstanceModalLocale(L) {
  const instanceModalTitle = document.getElementById('instanceModalTitle');
  const instanceModalMessage = document.getElementById('instanceModalMessage');
  const instanceModalInput = document.getElementById('instanceModalInput');
  const instanceSaveBtn = document.getElementById('instanceSaveBtn');
  const instanceCancelBtn = document.getElementById('instanceCancelBtn');

  if (instanceModalTitle) instanceModalTitle.textContent = L.instanceModalTitle || instanceModalTitle.textContent;
  if (instanceModalMessage) instanceModalMessage.textContent = L.instanceModalMessage || instanceModalMessage.textContent;
  if (instanceModalInput) instanceModalInput.placeholder = L.instancePlaceholder || instanceModalInput.placeholder;
  if (instanceSaveBtn) instanceSaveBtn.textContent = L.instanceSaveBtn || instanceSaveBtn.textContent;
  if (instanceCancelBtn) instanceCancelBtn.textContent = L.instanceCancelBtn || instanceCancelBtn.textContent;
}

function updateLinkModalLocale(L) {
  const linkModalTitle = document.getElementById('linkModalTitle');
  const linkinfoEl = document.getElementById('linkModalInfo');
  const linkModalInput = document.getElementById('linkModalInput');
  const linkModalDeleteBtn = document.getElementById('linkModalDeleteBtn');
  const linkModalSaveBtn = document.getElementById('linkModalSaveBtn');
  const linkModalCancelBtn = document.getElementById('linkModalCancelBtn');

  if (linkModalTitle) linkModalTitle.textContent = L.linkModalTitle || linkModalTitle.textContent;
  if (linkinfoEl) linkinfoEl.textContent = L.linkModalInfo || linkinfoEl.textContent;
  if (linkModalInput) linkModalInput.placeholder = L.linkModalPlaceholder || linkModalInput.placeholder;
  if (linkModalDeleteBtn) linkModalDeleteBtn.textContent = L.linkModalDelete || linkModalDeleteBtn.textContent;
  if (linkModalSaveBtn) linkModalSaveBtn.textContent = L.saveBtn || linkModalSaveBtn.textContent;
  if (linkModalCancelBtn) linkModalCancelBtn.textContent = L.cancelBtn || linkModalCancelBtn.textContent;
}

function updateCustomTemplateModalLocale(L) {
  const customTemplateModalTitle = document.getElementById('customTemplateModalTitle');
  const customTemplateinfoEl = document.getElementById('customTemplateModalInfo');
  const customTemplateModalInput = document.getElementById('customTemplateModalInput');
  const customTemplateModalDeleteBtn = document.getElementById('customTemplateModalDeleteBtn');
  const customTemplateModalSaveBtn = document.getElementById('customTemplateModalSaveBtn');
  const customTemplateModalCancelBtn = document.getElementById('customTemplateModalCancelBtn');

  if (customTemplateModalTitle) customTemplateModalTitle.textContent = L.customTemplateModalTitle || customTemplateModalTitle.textContent;
  if (customTemplateinfoEl) customTemplateinfoEl.innerHTML = L.customTemplateModalInfo || customTemplateinfoEl.innerHTML;
  if (customTemplateModalInput) customTemplateModalInput.placeholder = L.customTemplateModalPlaceholder || customTemplateModalInput.placeholder;
  if (customTemplateModalDeleteBtn) customTemplateModalDeleteBtn.textContent = L.customTemplateModalDelete || customTemplateModalDeleteBtn.textContent;
  if (customTemplateModalSaveBtn) customTemplateModalSaveBtn.textContent = L.saveBtn || customTemplateModalSaveBtn.textContent;
  if (customTemplateModalCancelBtn) customTemplateModalCancelBtn.textContent = L.cancelBtn || customTemplateModalCancelBtn.textContent;
}

function updateShortcutModalLocale(L) {
  const shortcutModalTitle = document.getElementById('shortcutModalTitle');
  const shortcutModalInfo = document.getElementById('shortcutModalInfo');
  const openChromeLinkEl = document.getElementById('shortcutOpenChromeLink');
  const slotLabelEl = document.getElementById('slotLabel');
  const actionLabelEl = document.getElementById('actionLabel');
  const unsetOpt = document.getElementById('unsetOption');
  const slotOpt1 = document.getElementById('slotOption1');
  const slotOpt2 = document.getElementById('slotOption2');
  const slotOpt3 = document.getElementById('slotOption3');
  const slotOpt4 = document.getElementById('slotOption4');
  const actionSelect = document.getElementById('actionSelect');
  const shortcutModalClearBtn = document.getElementById('shortcutModalClearBtn');
  const shortcutModalSaveBtn = document.getElementById('shortcutModalSaveBtn');
  const shortcutModalCancelBtn = document.getElementById('shortcutModalCancelBtn');

  if (shortcutModalTitle) shortcutModalTitle.textContent = L.shortcutModalTitle || shortcutModalTitle.textContent;
  if (shortcutModalInfo) shortcutModalInfo.textContent = L.shortcutModalInfo || shortcutModalInfo.textContent;
  if (openChromeLinkEl) openChromeLinkEl.textContent = L.shortcutOpenChromeLink || openChromeLinkEl.textContent;
  if (slotLabelEl) slotLabelEl.textContent = L.shortcutModalSlot || slotLabelEl.textContent;
  if (actionLabelEl) actionLabelEl.textContent = L.shortcutModalAction || actionLabelEl.textContent;
  if (unsetOpt) unsetOpt.textContent = L.unsetSlotText || unsetOpt.textContent;
  if (slotOpt1) slotOpt1.textContent = L.slotOptText1 || slotOpt1.textContent;
  if (slotOpt2) slotOpt2.textContent = L.slotOptText2 || slotOpt2.textContent;
  if (slotOpt3) slotOpt3.textContent = L.slotOptText3 || slotOpt3.textContent;
  if (slotOpt4) slotOpt4.textContent = L.slotOptText4 || slotOpt4.textContent;
  if (actionSelect && actionSelect.options && actionSelect.options.length >= 2) {
    actionSelect.options[0].text = L.actionOpenLink || actionSelect.options[0].text;
    actionSelect.options[1].text = L.actionCheckIn || actionSelect.options[1].text;
  }
  if (shortcutModalClearBtn) shortcutModalClearBtn.textContent = L.shortcutClear || shortcutModalClearBtn.textContent;
  if (shortcutModalSaveBtn) shortcutModalSaveBtn.textContent = L.saveBtn || shortcutModalSaveBtn.textContent;
  if (shortcutModalCancelBtn) shortcutModalCancelBtn.textContent = L.cancelBtn || shortcutModalCancelBtn.textContent;
}
