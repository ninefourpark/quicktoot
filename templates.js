// 简体中文默认模板
export const defaultTemplate = '关于 {topic} 的最新嘟嘟 ✨\n连续记录第 {streak} 天！\n{heatmap}\n\n这些文字来自 QuickToot 全局模板，你可以在「设置」中随时修改和清除。';

// 生成打卡文本
export function buildHabitPostText({ habit, streak, best, total, heatmap, siteTemplate, customTemplate }) {
  let template;
  if (customTemplate !== undefined && customTemplate !== null && customTemplate !== '') {
    template = customTemplate;
  } else if (siteTemplate === null) {
    // null 表示用户从未修改过，使用默认模板
    template = defaultTemplate;
  } else {
    // 空字符串或任意字符串，完全以用户保存的值为准（空就是空）
    template = siteTemplate;
  }
  return template
    .replace(/\{topic\}/g, habit.title || '')
    .replace(/\{streak\}/g, streak)
    .replace(/\{best\}/g, best)
    .replace(/\{total\}/g, total)
    .replace(/\{heatmap\}/g, heatmap);
}