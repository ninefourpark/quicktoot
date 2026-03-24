/**
 * 键盘导航和快捷键处理模块
 */

export function initKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    const habitListEl = document.getElementById('habitList');
    const newHabitInput = document.getElementById('newHabit');
    const current = document.activeElement;
    if (!habitListEl || !newHabitInput) return;

    // Enter 键：habit 行触发 checkbox
    if (e.key === 'Enter' && current.classList.contains('habit')) {
      e.preventDefault();
      const checkbox = current.querySelector('input[type="checkbox"]');
      if (checkbox) { checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change')); }
      return;
    }

    // Enter 键：details summary 折叠展开
    if (e.key === 'Enter' && current.tagName === 'SUMMARY') {
      // 浏览器原生已处理，不需要额外操作
      return;
    }

    // ── Tab 栏：左右方向键在各 tab 之间切换，下方向键进入 quick-toot-row ──
    const siteTabBar = document.getElementById('siteTabBar');
    if (siteTabBar && siteTabBar.contains(current)) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const tabs = Array.from(siteTabBar.querySelectorAll('button'));
        const idx = tabs.indexOf(current);
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[idx + dir];
        if (next) next.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        document.getElementById('quickTootBtn')?.focus();
        return;
      }
      // ArrowUp：Tab 栏已是顶部，不处理
      return;
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    // 在 modal 开着的时候不劫持方向键
    const openModal = document.querySelector('.modal-overlay[style*="flex"]');
    if (openModal) return;

    e.preventDefault();
    const habits = Array.from(habitListEl.querySelectorAll('.habit'));
    const dir = e.key === 'ArrowDown' ? 1 : -1;


    // ── quick-toot-row：作为整体节点纳入垂直导航链 ──
    // 内部两个按钮用 Tab 切换；上下方向键负责离开这一行
    const quickTootBtn = document.getElementById('quickTootBtn');
    const quickTootOptionsBtn = document.getElementById('quickTootOptionsBtn');
    if (current === quickTootBtn || current === quickTootOptionsBtn) {
      if (dir === -1) {
        // 上移：回到 Tab 栏当前激活的 tab
        const activeTab = siteTabBar?.querySelector('.site-tab.active');
        const fallback = siteTabBar?.querySelector('button');
        (activeTab || fallback)?.focus();
      } else {
        // 下移：进入第一个 habit 或 newHabit 输入框
        if (habits.length > 0) habits[0].focus();
        else newHabitInput.focus();
      }
      return;
    }

    // ── habit 列表内垂直导航 ──
    if (current.classList.contains('habit')) {
      const idx = habits.indexOf(current);
      const next = habits[idx + dir];
      if (next) { 
        next.focus();
      } else if (dir === 1) {
        newHabitInput.focus();
        // dir === -1 且 idx === 0：焦点停在第一个 habit，不上移到 tab 栏
      } else {
        // 上移到 quick-toot-row
        quickTootBtn?.focus();
      }
      return;
    }

    // ── newHabit 输入框 ──
    if (current === newHabitInput) {
      if (dir === 1) {
        // 下移到站点设置 summary
        const summary = document.querySelector('#siteSettingsDetails > summary');
        summary?.focus();
      } else {
        // 上移到最后一个 habit 或 quickTootBtn
        if (habits.length > 0) habits[habits.length - 1].focus();
        else quickTootBtn?.focus();
      }
      return;
    }


    // 在 details 内部：方向键在 focusable 元素间移动
    // 排除 textarea 和 select，避免劫持其原生方向键行为
    const allDetails = document.querySelectorAll('details');
    for (const det of allDetails) {
      if (det.contains(current)) {
        const focusable = Array.from(det.querySelectorAll(
          'input:not([disabled]):not([type="file"]), button:not([disabled]), summary'
        ));
        const idx = focusable.indexOf(current);
        if (idx !== -1) {
          const next = focusable[idx + dir];
          if (next) next.focus();
        }
        return;
      }
    }
  });
}

export function initFocusScroll() {
  document.addEventListener('keydown', () => { window.isKeyboardUser = true; });
  document.addEventListener('mousedown', () => { window.isKeyboardUser = false; });
  // 监听所有 form-content 区域（可能有多个）
  document.addEventListener('focusin', (event) => {
    if (!window.isKeyboardUser) return;
    const tags = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'];
    if (tags.includes(event.target.tagName)) {
      event.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

export function initNewHabitFocusScroll() {
  const input = document.getElementById('newHabit');
  if (!input) return;
  input.addEventListener('focus', () => {
    setTimeout(() => {
      input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 100);
  });
}

export function setupEnterKeySubmit(inputSelector, buttonSelector) {
  const input = document.querySelector(inputSelector);
  const button = document.querySelector(buttonSelector);
  if (input && button) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); button.click(); }
    });
  }
}