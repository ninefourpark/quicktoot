/**
 * 习惯数据管理模块
 */

/**
 * 规范化实例地址（添加https://前缀并移除末尾斜杠）
 */
export function normalizeInstance(input) {
  if (!input) return '';
  let v = input.trim();
  if (!/^https?:\/\//i.test(v)) {
    v = 'https://' + v;
  }
  v = v.replace(/\/$/, '');
  return v;
}

/**
 * 验证并规范化实例地址
 */
export function validateAndNormalizeInstance(input) {
  if (!input) return null;
  const v = normalizeInstance(input);
  try {
    const u = new URL(v);
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname && u.hostname.indexOf('.') !== -1) {
      return v;
    }
  } catch (e) {
    return null;
  }
  return null;
}

/**
 * 计算连续天数
 */
export function calcStreak(records) {
  let count = 0;
  let d = new Date();

  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (records[key]) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/**
 * 生成两周热力图
 */
export function buildHeatmap(records, done, empty) {
  let result = '';
  let d = new Date();

  for (let i = 0; i < 14; i++) {
    const key = d.toISOString().slice(0, 10);
    result = (records[key] ? done : empty) + result;
    if (i === 6) result = '\n' + result;
    d.setDate(d.getDate() - 1);
  }
  return result;
}

/**
 * 删除指定习惯
 */
export function deleteHabitById(id, callback) {
  chrome.storage.local.get({ habits: [] }, data => {
    const newHabits = (data.habits || []).filter(h => h.id !== id);
    chrome.storage.local.set({ habits: newHabits }, () => {
      try {
        chrome.storage.local.remove(String(id), callback);
      } catch (e) {
        callback();
      }
    });
  });
}

/**
 * 移动习惯位置
 */
export function moveHabitById(id, dir, onSuccess) {
  chrome.storage.local.get({ habits: [] }, data => {
    const h = data.habits || [];
    const i = h.findIndex(x => x.id === id);
    if (i === -1) return;
    const ni = i + dir;
    if (ni < 0 || ni >= h.length) return;
    [h[i], h[ni]] = [h[ni], h[i]];
    chrome.storage.local.set({ habits: h }, onSuccess);
  });
}

/**
 * 获取习惯完成状态（是否已完成今天的习惯）
 */
export function isHabitDoneToday(habit) {
  const today = new Date().toISOString().slice(0, 10);
  return habit.records && habit.records[today] ? true : false;
}
