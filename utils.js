
// utils.js 要做的事情： 计算 streak、生成热力图、拼嘟嘟文本

export async function updateHabit(id) {
  const today = new Date().toISOString().slice(0, 10);

  const data = await browser.storage.local.get(id);
  const habit = data[id] || {
    dates: [],
    best: 0
  };

  if (!habit.dates.includes(today)) {
    habit.dates.push(today);
  }

  const streak = calcStreak(habit.dates);
  habit.best = Math.max(habit.best, streak);

  await browser.storage.local.set({
    [id]: habit
  });

  return {
    streak,
    best: habit.best,
    heatmap: buildHeatmap(habit.dates)
  };
}

function calcStreak(dates) {
  const set = new Set(dates);
  let streak = 0;
  let day = new Date();

  while (true) {
    const key = day.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

function buildHeatmap(dates) {
  const set = new Set(dates);
  const result = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push(set.has(key) ? '🔥' : '⚪');
  }

  return result;
}


// 要发布的内容
export function buildTootText(title, data) {
  const lines = [];
  lines.push(`【${title}】今日完成！`);
  lines.push('');
  lines.push(`🔥 Current streak: ${data.streak} day`);
  lines.push(`🏆 Best: ${data.best} day`);
  lines.push('');
  lines.push('热力图（两周）');
  lines.push('');
  lines.push(data.heatmap.slice(0, 7).join(''));
  lines.push(data.heatmap.slice(7).join(''));

  return lines.join('\n');
}

// 发送之前删除 @
export function stripMentions(text) {
  return text.replace(
    /@([a-zA-Z0-9_]+)(@[a-zA-Z0-9.-]+)?/g,
    '$1'
  );
}
