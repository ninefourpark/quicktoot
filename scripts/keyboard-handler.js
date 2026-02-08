/**
 * 键盘导航和快捷键处理模块
 */

/**
 * 初始化键盘导航逻辑
 */
export function initKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    const habitListEl = document.getElementById('habitList');
    const newHabitInput = document.getElementById('newHabit');
    const settingsDetails = document.getElementById('settingsDetails');
    const settingsHeading = document.getElementById('settingsHeading');
    const current = document.activeElement;

    if (e.key === 'Enter') {
      if (current.classList.contains('habit')) {
        e.preventDefault();
        const checkbox = current.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
        return;
      }
      if (current === settingsHeading) {
        e.preventDefault();
        settingsDetails.open = !settingsDetails.open;
        settingsHeading.setAttribute('aria-expanded', settingsDetails.open);
        if (settingsDetails.open) {
          const firstControl = settingsDetails.querySelector('input, button, textarea');
          firstControl?.focus();
        }
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const habits = Array.from(habitListEl.querySelectorAll('.habit'));
      if (current.classList.contains('habit')) {
        const idx = habits.indexOf(current);
        if (idx < habits.length - 1) habits[idx + 1].focus();
        else newHabitInput.focus();
      } else if (current === newHabitInput) {
        settingsHeading.focus();
      } else if (current === settingsHeading) {
        if (settingsDetails.open) {
          const first = settingsDetails.querySelector('input, button, textarea');
          first?.focus();
        }
      } else if (settingsDetails.contains(current)) {
        const controls = Array.from(settingsDetails.querySelectorAll('input, button, textarea'));
        const idx = controls.indexOf(current);
        if (idx < controls.length - 1) controls[idx + 1].focus();
      }
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const habits = Array.from(habitListEl.querySelectorAll('.habit'));
      if (settingsDetails.contains(current) && current !== settingsHeading) {
        const controls = Array.from(settingsDetails.querySelectorAll('input, button, textarea'));
        const idx = controls.indexOf(current);
        if (idx > 0) controls[idx - 1].focus();
        else settingsHeading.focus();
      } else if (current === settingsHeading) {
        newHabitInput.focus();
      } else if (current === newHabitInput) {
        if (habits.length > 0) habits[habits.length - 1].focus();
        else {
          const langButtons = document.querySelectorAll('.langBtn');
          if (langButtons.length > 0) langButtons[0].focus();
        }
      } else if (current.classList.contains('habit')) {
        const idx = habits.indexOf(current);
        if (idx > 0) habits[idx - 1].focus();
      }
    }
  });
}

/**
 * 初始化焦点滚动行为
 */
export function initFocusScroll() {
  document.addEventListener('keydown', () => { window.isKeyboardUser = true; });
  document.addEventListener('mousedown', () => { window.isKeyboardUser = false; });
  document.querySelector('.form-content')?.addEventListener('focusin', (event) => {
    const tags = ['INPUT', 'TEXTAREA', 'BUTTON'];
    if (tags.includes(event.target.tagName) && window.isKeyboardUser) {
      event.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
}

/**
 * 初始化新增习惯输入框的焦点滚动
 */
export function initNewHabitFocusScroll() {
  const input = document.getElementById('newHabit');
  const stickyBar = document.querySelector('.sticky-save');
  if (!input) return;

  input.addEventListener('focus', () => {
    setTimeout(() => {
      const rect = input.getBoundingClientRect();
      const stickyHeight = stickyBar ? stickyBar.offsetHeight : 0;
      const buffer = 20;
      const availableHeight = window.innerHeight - stickyHeight;
      const offset = rect.bottom - availableHeight + buffer;
      if (offset > 0) {
        window.scrollBy({
          top: offset,
          behavior: 'smooth'
        });
      }
    }, 150);
  });
}

/**
 * 支持通过Enter键提交
 */
export function setupEnterKeySubmit(inputSelector, buttonSelector) {
  const input = document.querySelector(inputSelector);
  const button = document.querySelector(buttonSelector);
  if (input && button) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        button.click();
      }
    });
  }
}
