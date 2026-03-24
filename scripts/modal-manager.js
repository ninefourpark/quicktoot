/**
 * Modal 窗口管理模块
 */

// 记录每个 overlay 打开时的触发元素，关闭时用于还原焦点
const _triggerMap = new Map();

/**
 * 焦点陷阱 - 当聚焦在modal的时候，让焦点在modal内部循环
 */
export function trapFocus(modalElement) {
  const focusableElements = modalElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  modalElement.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  });
}

/**
 * 显示Modal并调整窗口高度
 * 同时记录当前焦点元素，供 hideModal 关闭后还原。
 */
export function showModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;

  // 记录触发元素（打开 modal 之前持有焦点的元素）
  _triggerMap.set(overlayId, document.activeElement);

  const modalElement = overlay.querySelector('.modal');
  overlay.style.display = 'flex';
  if (modalElement) {
    const modalHeight = modalElement.scrollHeight;
    document.body.style.height = (modalHeight + 100) + 'px';
  }
}

/**
 * 隐藏Modal并恢复窗口高度
 */
export function hideModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.style.display = 'none';
  document.body.style.height = 'auto';

  // 还原焦点到触发元素
  const trigger = _triggerMap.get(overlayId);
  if (trigger && typeof trigger.focus === 'function') {
    // 用 setTimeout 确保 overlay 已隐藏、DOM 稳定后再移焦点
    setTimeout(() => trigger.focus(), 0);
  }
  _triggerMap.delete(overlayId);
}

/**
 * 自动聚焦到Modal内的输入框
 * 优先顺序：input / textarea → select → button
 * 这样在没有文字输入框的 modal（如快捷键设置）里，
 * 焦点也能正确落到 select 或第一个按钮上。
 */
export function focusModalInput(modalId) {
  setTimeout(() => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const target =
      modal.querySelector('input, textarea') ||
      modal.querySelector('select') ||
      modal.querySelector('button');
    if (target) target.focus();
  }, 150);
}