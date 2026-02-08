/**
 * UI 渲染模块
 */

import { LOCALES } from '../locales.js';
import { ICONS } from '../icons/icons.js';
import { isHabitDoneToday } from './habit-manager.js';

/**
 * 渲染习惯列表
 */
export function renderHabitList(habits, data, onHabitDone, onHabitUnDone, onMoveHabit, onDeleteHabit, onEditTitle, onBindThread, onEditShortcut, onEditLink, onEditCustomTemplate) {
  const habitListEl = document.getElementById('habitList');
  habitListEl.innerHTML = '';

  const L = LOCALES[data.language] || LOCALES['zh-cn'];

  habits.forEach((habit, idx) => {
    const div = document.createElement('div');
    div.className = 'habit';
    div.setAttribute('role', 'option');
    div.tabIndex = 0;
    div.dataset.habitId = habit.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.tabIndex = -1;

    if (isHabitDoneToday(habit)) {
      checkbox.checked = true;
    }

    checkbox.addEventListener('change', () => {
      div.setAttribute('aria-checked', checkbox.checked);
      if (checkbox.checked) {
        onHabitDone(habit, habit.id);
      } else {
        onHabitUnDone(habit, habit.id);
      }
    });

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = habit.title;

    if (habit.link) {
      label.classList.add('linked');
      label.title = habit.link;
      label.addEventListener('click', () => {
        window.open(habit.link);
      });
    }

    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      onEditTitle(habit, label, idx);
    });

    let threadBadge = null;
    if (habit.root_status_id) {
      threadBadge = document.createElement('span');
      threadBadge.className = 'threadBadge';
      threadBadge.title = L.threadBadgeTilte || '已绑定串文';
      threadBadge.innerHTML = ICONS.bindBadge;
    }

    let badge = null;
    if (habit.shortcutSlot) {
      badge = document.createElement('span');
      badge.className = 'shortcutBadge';
      badge.title = L.shortcutBadgeTilte || '已绑定快捷键';
      badge.innerHTML = `${ICONS.shortcutBadge} ${habit.shortcutSlot}`;
    }

    const controls = document.createElement('span');
    controls.className = 'controls';

    const upBtn = document.createElement('button');
    upBtn.classList.add('habit-move-up-btn');
    upBtn.textContent = '▲';
    upBtn.title = L.moveUp || 'Up';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => onMoveHabit(habit.id, -1, 'habit-move-up-btn'));

    const downBtn = document.createElement('button');
    downBtn.classList.add('habit-move-down-btn');
    downBtn.textContent = '▼';
    downBtn.title = L.moveDown || 'Down';
    downBtn.disabled = idx === habits.length - 1;
    downBtn.addEventListener('click', () => onMoveHabit(habit.id, 1, 'habit-move-down-btn'));

    const optionsBtn = document.createElement('button');
    optionsBtn.className = 'optionsBtn';
    optionsBtn.textContent = '⋯';
    optionsBtn.title = '选项';

    const menu = document.createElement('div');
    menu.className = 'habitMenu';
    menu.tabIndex = 0;

    menu.addEventListener('focusout', (e) => {
      if (!menu.contains(e.relatedTarget)) {
        menu.style.display = 'none';
      }
    });

    function mkItem(content, onClick) {
      const b = document.createElement('button');
      b.className = 'menu-item';
      b.innerHTML = content;

      b.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        menu.style.display = 'none';

        if (document.activeElement) {
          document.activeElement.blur();
        }

        onClick();
      });
      return b;
    }

    menu.appendChild(mkItem(`${ICONS.edit} <span>${L.editEditTitle || 'Rename'}</span>`, () => onEditTitle(habit, label, idx)));
    menu.appendChild(mkItem(`${ICONS.bind} <span>${L.bindThread || 'Thread'}</span>`, () => onBindThread(habit)));
    menu.appendChild(mkItem(`${ICONS.shortcut} <span>${L.editShortcut || 'Shortcut'}</span>`, () => onEditShortcut(habit)));
    menu.appendChild(mkItem(`${ICONS.link} <span>${L.editLink || 'Link'}</span>`, () => onEditLink(habit)));
    menu.appendChild(mkItem(`${ICONS.customTemplate} <span>${L.editCustomTemplate || 'Template'}</span>`, () => onEditCustomTemplate(habit)));

    const deleteBtn = mkItem(
      ICONS.delete + (L.deleteBtn || 'Delete'),
      () => onDeleteHabit(habit.id, habit.title)
    );
    deleteBtn.id = 'habitDeleteBtn';
    menu.appendChild(deleteBtn);

    menu.tabIndex = 0;
    menu.addEventListener('focusout', (e) => {
      if (!menu.contains(e.relatedTarget)) {
        menu.style.display = 'none';
      }
    });

    optionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = menu.style.display === 'block';
      hideAllHabitMenus();
      if (!wasOpen) {
        menu.style.display = 'block';
        menu.focus();
        updateWindowHeight();
      }
    });

    div.appendChild(checkbox);
    div.appendChild(label);
    if (threadBadge) div.appendChild(threadBadge);
    if (badge) div.appendChild(badge);
    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    controls.appendChild(optionsBtn);
    controls.appendChild(menu);
    div.appendChild(controls);
    habitListEl.appendChild(div);
  });
}

/**
 * 隐藏所有习惯菜单
 */
export function hideAllHabitMenus() {
  document.querySelectorAll('.habitMenu').forEach(m => m.style.display = 'none');
}

/**
 * 加载完成后的焦点管理
 */
export function manageFocus(isFromSubmit = false, lastFocusedId = null, lastFocusedClass = null) {
  const habitListEl = document.getElementById('habitList');
  const newHabitInput = document.getElementById('newHabit');

  function focusInitialHabit(fromNewHabitSubmit = false) {
    const habits = habitListEl.querySelectorAll('.habit');
    if (fromNewHabitSubmit && newHabitInput) {
      newHabitInput?.focus();
      return;
    }
    if (habits.length > 0) {
      habits[0].focus();
    } else if (newHabitInput) {
      newHabitInput.focus();
    }
  }

  if (lastFocusedId) {
    const targetHabit = habitListEl.querySelector(`[data-habit-id="${lastFocusedId}"]`);
    if (targetHabit) {
      const targetBtn = targetHabit.querySelector(`.${lastFocusedClass}`);
      if (targetBtn && !targetBtn.disabled) {
        targetBtn.focus();
      } else {
        targetHabit.focus();
      }
    }
  } else {
    focusInitialHabit(isFromSubmit);
  }
}

/**
 * 更新窗口高度
 */
export function updateWindowHeight() {
  const currentHeight = document.body.scrollHeight;
  chrome.runtime.sendMessage({
    action: 'resizeWindow',
    height: currentHeight
  });
}

/**
 * 初始化窗口高度观察器
 */
export function initResizeObserver() {
  const resizeObserver = new ResizeObserver(() => {
    updateWindowHeight();
  });
  resizeObserver.observe(document.body);
}

/**
 * 更新设置输入框显示
 */
export function updateSettingsDisplay(data) {
  const instanceInput = document.getElementById('instanceInput');
  const emojiDoneInput = document.getElementById('emojiDoneInput');
  const emojiEmptyInput = document.getElementById('emojiEmptyInput');
  const enableThreadingInput = document.getElementById('enableThreadingInput');
  const visibilitySelectEl = document.getElementById('visibilitySelect');
  const templateInput = document.getElementById('templateInput');

  if (instanceInput) instanceInput.value = data.instance;
  if (emojiDoneInput) emojiDoneInput.value = data.emojiDone;
  if (emojiEmptyInput) emojiEmptyInput.value = data.emojiEmpty;
  if (enableThreadingInput) enableThreadingInput.checked = data.enableThreading;
  if (visibilitySelectEl) visibilitySelectEl.value = data.defaultVisibility || 'public';
}
