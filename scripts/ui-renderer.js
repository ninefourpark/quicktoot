/**
 * UI 渲染模块
 */
import { ICONS } from '../icons/icons.js';
import { isHabitDoneToday } from './habit-manager.js';

export function renderHabitList(habits, site, data, onHabitDone, onHabitUnDone, onMoveHabit, onDeleteHabit, onEditTitle, onBindThread, onEditShortcut, onEditLink, onEditCustomTemplate) {
  const habitListEl = document.getElementById('habitList');
  habitListEl.innerHTML = '';

  habits.forEach((habit, idx) => {
    const div = document.createElement('div');
    div.className = 'habit';
    div.setAttribute('role', 'option');
    div.tabIndex = 0;
    div.dataset.habitId = habit.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.tabIndex = -1;
    if (isHabitDoneToday(habit)) checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      div.setAttribute('aria-checked', checkbox.checked);
      if (checkbox.checked) onHabitDone(habit, habit.id);
      else onHabitUnDone(habit, habit.id);
    });

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = habit.title;
    if (habit.link) {
      label.classList.add('linked');
      label.title = habit.link;
      label.addEventListener('click', () => window.open(habit.link));
    }
    label.addEventListener('dblclick', e => { e.stopPropagation(); onEditTitle(habit, label, idx); });

    let threadBadge = null;
    if (habit.root_status_id) {
      threadBadge = document.createElement('span');
      threadBadge.className = 'threadBadge';
      threadBadge.title = '已绑定串文';
      threadBadge.innerHTML = ICONS.bindBadge;
    }

    let badge = null;
    if (habit.shortcutSlot) {
      badge = document.createElement('span');
      badge.className = 'shortcutBadge';
      badge.title = '已绑定快捷键';
      badge.innerHTML = `${ICONS.shortcutBadge} ${habit.shortcutSlot}`;
    }

    const controls = document.createElement('span');
    controls.className = 'controls';

    const upBtn = document.createElement('button');
    upBtn.classList.add('habit-move-up-btn');
    upBtn.textContent = '▲'; upBtn.title = '上移'; upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => onMoveHabit(habit.id, -1, 'habit-move-up-btn'));

    const downBtn = document.createElement('button');
    downBtn.classList.add('habit-move-down-btn');
    downBtn.textContent = '▼'; downBtn.title = '下移'; downBtn.disabled = idx === habits.length - 1;
    downBtn.addEventListener('click', () => onMoveHabit(habit.id, 1, 'habit-move-down-btn'));

    const optionsBtn = document.createElement('button');
    optionsBtn.className = 'optionsBtn';
    optionsBtn.textContent = '⋯'; optionsBtn.title = '更多操作';

    const menu = document.createElement('div');
    menu.className = 'habitMenu'; menu.tabIndex = 0;
    menu.addEventListener('focusout', e => { if (!menu.contains(e.relatedTarget)) menu.style.display = 'none'; });

    function mkItem(content, onClick) {
      const b = document.createElement('button');
      b.className = 'menu-item'; b.innerHTML = content;
      b.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        menu.style.display = 'none';
        if (document.activeElement) document.activeElement.blur();
        onClick();
      });
      return b;
    }

    menu.appendChild(mkItem(`${ICONS.edit} <span>重命名</span>`, () => onEditTitle(habit, label, idx)));
    menu.appendChild(mkItem(`${ICONS.bind} <span>绑定串文</span>`, () => onBindThread(habit)));
    menu.appendChild(mkItem(`${ICONS.shortcut} <span>快捷键</span>`, () => onEditShortcut(habit)));
    menu.appendChild(mkItem(`${ICONS.link} <span>关联网页</span>`, () => onEditLink(habit)));
    menu.appendChild(mkItem(`${ICONS.customTemplate} <span>专用模板</span>`, () => onEditCustomTemplate(habit)));

    const deleteBtn = mkItem(ICONS.delete + '删除', () => onDeleteHabit(habit.id, habit.title));
    deleteBtn.id = 'habitDeleteBtn';
    menu.appendChild(deleteBtn);

    optionsBtn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = menu.style.display === 'block';
      hideAllHabitMenus();
      if (!wasOpen) { menu.style.display = 'block'; menu.focus(); updateWindowHeight(); }
    });

    div.appendChild(checkbox);
    div.appendChild(label);
    if (threadBadge) div.appendChild(threadBadge);
    if (badge) div.appendChild(badge);
    controls.appendChild(upBtn); controls.appendChild(downBtn);
    controls.appendChild(optionsBtn); controls.appendChild(menu);
    div.appendChild(controls);
    habitListEl.appendChild(div);
  });
}

export function hideAllHabitMenus() {
  document.querySelectorAll('.habitMenu').forEach(m => m.style.display = 'none');
}

export function manageFocus(isFromSubmit = false, lastFocusedId = null, lastFocusedClass = null) {
  const habitListEl = document.getElementById('habitList');
  const newHabitInput = document.getElementById('newHabit');
  if (lastFocusedId) {
    const target = habitListEl.querySelector(`[data-habit-id="${lastFocusedId}"]`);
    if (target) {
      const btn = target.querySelector(`.${lastFocusedClass}`);
      if (btn && !btn.disabled) btn.focus(); else target.focus();
    }
  } else {
    if (isFromSubmit && newHabitInput) { newHabitInput.focus(); return; }
    const habits = habitListEl.querySelectorAll('.habit');
    if (habits.length > 0) habits[0].focus();
    else if (newHabitInput) newHabitInput.focus();
  }
}

export function updateWindowHeight() {
  chrome.runtime.sendMessage({ action: 'resizeWindow', height: document.body.scrollHeight });
}

export function initResizeObserver() {
  new ResizeObserver(() => updateWindowHeight()).observe(document.body);
}