
// 所有语言的默认模板(全局)
export const defaultTemplates = {
  'zh-cn': '关于 {topic} 的最新嘟嘟 ✨\n连续记录第 {streak} 天！\n{heatmap}\n\n这些文字来自 QuickToot 全局模板，你可以在「设置」中随时修改和清除。',
  'zh-tw': '關於 {topic} 的最新嘟嘟 ✨\n連續記錄第 {streak} 天！\n{heatmap}\n\n这些文字來自 QuickToot 全域範本，你可以在設定中隨時修改和清除。',
  'en-us': 'Latest update on {topic} ✨\nDay {streak} of my streak!\n{heatmap}\n\nSent via QuickToot. You can customize this global template or set up threads in the Settings.',
  'jp': '{topic} についてのアップデート ✨\n現在 {streak} 日連続で更新中！\n{heatmap}\n\nQuickToot のテンプレートを使用中。設定からカスタマイズが可能です。',
};

// 根据语言，优先使用用户自定义模板
export function getTemplate(lang, userTemplates = {}) {
  if (lang in userTemplates) {
    return userTemplates[lang];
  }
  return defaultTemplates[lang] || defaultTemplates['en-us'];
}


// 把数据渲染成最终文本
export function renderTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return context[key] != null ? String(context[key]) : '';
  });
}

// 生成打卡文本
export function buildHabitPostText({
  habit,
  streak,
  best,
  total,
  heatmap,
  lang,
  userTemplates = {},
  customTemplate 
}) {
  let template;

  if (customTemplate !== undefined && customTemplate !== null) {
    template = customTemplate;
  } else if (lang in userTemplates) {
    template = userTemplates[lang];
  } else {
    template = defaultTemplates[lang] || defaultTemplates['en'];
  }

  return template
    .replace(/\{topic\}/g, habit.title || '')
    .replace(/\{streak\}/g, streak)
    .replace(/\{best\}/g, best)
    .replace(/\{total\}/g, total)
    .replace(/\{heatmap\}/g, heatmap);
}