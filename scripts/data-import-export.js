/**
 * 数据导入导出模块
 */

import { normalizeLang } from './locale-manager.js';
import { LOCALES } from '../locales.js';

const EXCLUDE_KEYS = ['clients', 'enableThreading', 'instance', 'instancePromptDismissed'];

/**
 * 导出数据为JSON文件
 */
export function exportData() {
  chrome.storage.local.get(null, (data) => {
    EXCLUDE_KEYS.forEach(key => delete data[key]);
    const jsonData = JSON.stringify(data, null, 2);
    chrome.runtime.sendMessage({ type: 'EXPORT_DATA', json: jsonData });
  });
}

/**
 * 导入数据从JSON文件
 */
export function importData(file, onSuccess) {
  if (!file) return;

  chrome.storage.local.get({ language: 'zh-cn' }, data => {
    const lang = normalizeLang(data.language);
    const L = LOCALES[lang];

    if (!confirm(L.importConfirm)) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const importedData = JSON.parse(reader.result);
        const mergedData = {
          ...importedData,
          language: normalizeLang(importedData.language)
        };

        chrome.storage.local.set(mergedData, () => {
          alert(L.importSuccess);
          onSuccess();
        });
      } catch (e) {
        alert(L.importError);
      }
    };
    reader.readAsText(file);
  });
}
