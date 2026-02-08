/**
 * Modal 窗口管理模块
 */

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
 */
export function showModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
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
}

/**
 * 自动聚焦到Modal内的输入框
 */
export function focusModalInput(modalId) {
  setTimeout(() => {
    const modal = document.getElementById(modalId);
    if (modal) {
      const input = modal.querySelector('input, textarea');
      if (input) input.focus();
    }
  }, 150);
}
