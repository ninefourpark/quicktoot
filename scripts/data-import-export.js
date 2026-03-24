/**
 * 数据导入导出模块
 *
 * 导出分两种，按用户意图而非数据范围划分：
 *
 *   exportBackup(siteId?)
 *     仅导出话题内容和配置，不含 accessToken / clients。
 *     适合备份、存档、分享给他人。文件名含 Backup 前缀。
 *
 *   exportMigration()
 *     导出完整数据，含 accessToken / clients，可直接迁移到新设备。
 *     导出前展示安全警告，文件名含 SENSITIVE 前缀以提示风险。
 *
 * 导入分两种，与导出对应：
 *
 *   importBackup(file, siteId?, onSuccess)
 *     导入备份文件（不含凭证）。
 *     siteId 有值时覆盖单站点，无值时覆盖全部站点。
 *
 *   importMigration(file, onSuccess)
 *     导入迁移文件（含凭证）。
 *     检测到文件含 accessToken 时，展示安全提示要求用户二次确认。
 *     导入完成后静默验证 token 有效性，失效则提示重新授权。
 */

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

function getDateTimeStr() {
  const now = new Date();
  const date =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const time =
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0');
  return `${date}_${time}`;
}

function sendExport(json, filename) {
  chrome.runtime.sendMessage({ type: 'EXPORT_DATA', json, filename });
}

/**
 * 从 site 对象中剥除认证字段，返回仅含内容和配置的副本
 */
function stripAuth(site) {
  const { accessToken, clients, ...rest } = site; // eslint-disable-line no-unused-vars
  return rest;
}

/**
 * 判断一个已解析的导入对象是否含有认证凭证
 */
/**
 * 判断一个已解析的导入对象是否含有认证凭证。
 * 兼容两种格式：
 *   - 新版：{ sites: [{ accessToken, clients, ... }] }
 *   - 旧版：{ accessToken, habits, ... }（顶层直接含凭证）
 */
function hasCredentials(imported) {
  // 旧版格式：顶层含 accessToken
  if (!imported.sites && imported.accessToken) return true;
  if (!imported.sites || !Array.isArray(imported.sites)) return false;
  return imported.sites.some(s => s.accessToken || (s.clients && Object.keys(s.clients).length > 0));
}

// ─── 导出 ─────────────────────────────────────────────────────────────────────

/**
 * 备份导出
 * siteId 有值：仅导出该站点的话题数据（不含凭证）
 * siteId 无值：导出全部站点的话题数据（不含凭证）
 */
export function exportBackup(siteId) {
  chrome.storage.local.get(null, (data) => {
    const sites = data.sites || [];

    let payload;
    let fileLabel;

    if (siteId != null) {
      // 单站点备份
      const site = sites.find(s => s.id === siteId);
      if (!site) return;
      payload = { siteBackup: stripAuth(site) };
      fileLabel = 'Backup_Site';
    } else {
      // 全部站点备份
      const exclude = ['instancePromptDismissed'];
      const exportData = { ...data, sites: sites.map(stripAuth) };
      exclude.forEach(k => delete exportData[k]);
      payload = exportData;
      fileLabel = 'Backup';
    }

    const json = JSON.stringify(payload, null, 2);
    const filename = `QuickToot_${fileLabel}_${getDateTimeStr()}.json`;
    sendExport(json, filename);
  });
}

/**
 * 迁移导出（含凭证）
 * 导出前向用户展示安全警告，确认后再执行。
 */
export function exportMigration() {
  const confirmed = confirm(
    '⚠️ 迁移文件包含你的登录凭证（Access Token）\n\n' +
    '任何人拿到这个文件，都可以用你的账号发布嘟文。\n\n' +
    '请仅在迁移到自己的新设备时使用，不要上传到云盘或分享给他人。\n\n' +
    '确认导出？'
  );
  if (!confirmed) return;

  chrome.storage.local.get(null, (data) => {
    const exclude = ['instancePromptDismissed'];
    const exportData = { ...data };
    exclude.forEach(k => delete exportData[k]);

    const json = JSON.stringify(exportData, null, 2);
    const filename = `QuickToot_SENSITIVE_Migration_${getDateTimeStr()}.json`;
    sendExport(json, filename);
  });
}

// ─── 导入 ─────────────────────────────────────────────────────────────────────

/**
 * 导入备份文件
 * siteId 有值：覆盖单站点话题数据
 * siteId 无值：覆盖全部站点数据（不会写入凭证，即使文件中含有）
 */
export function importBackup(file, siteId, onSuccess) {
  if (!file) return;

  const isSite = siteId != null;
  const confirmMsg = isSite
    ? '导入数据会覆盖此实例的所有话题，是否继续？'
    : '导入数据会覆盖所有实例的话题和设置，是否继续？';

  if (!confirm(confirmMsg)) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (isSite) {
        // 单站点导入
        _importSingleSite(imported, siteId, onSuccess);
      } else {
        // 全部站点导入（强制剥除凭证，即使文件里有也不写入）
        _importAllSites(imported, { stripCredentials: true }, onSuccess);
      }
    } catch (e) {
      alert('JSON 文件无法解析，请确认文件是否正确');
    }
  };
  reader.readAsText(file);
}

/**
 * 导入迁移文件（含凭证）
 * 如果文件中含有 accessToken，展示安全提示要求二次确认。
 * 导入完成后静默验证 token，失效则提示重新授权。
 */
export function importMigration(file, onSuccess) {
  if (!file) return;
  if (!confirm('导入迁移文件会覆盖所有实例的话题、设置和登录凭证，是否继续？')) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      // 检测到凭证：要求二次确认
      if (hasCredentials(imported)) {
        const confirmed = confirm(
          '⚠️ 这个文件包含登录凭证（Access Token）\n\n' +
          '请确认这是你自己从其他设备导出的迁移文件，而不是来自他人或不明来源。\n\n' +
          '确认导入？'
        );
        if (!confirmed) return;
      }

      _importAllSites(imported, { stripCredentials: false }, () => {
        onSuccess && onSuccess();
        // 导入完成后，静默验证所有站点的 token 是否仍然有效
        _verifyAllTokens();
      });
    } catch (e) {
      alert('JSON 文件无法解析，请确认文件是否正确');
    }
  };
  reader.readAsText(file);
}

// ─── 内部导入实现 ──────────────────────────────────────────────────────────────

/**
 * 覆盖全部站点数据
 * stripCredentials: true 时，写入前剥除所有 accessToken / clients
 */
function _importAllSites(imported, { stripCredentials }, onSuccess) {
  let data = imported;

  // 兼容旧版本：没有 sites 数组时自动转换
  if (!data.sites || !Array.isArray(data.sites)) {
    const siteId = Date.now();
    const site = {
      id: siteId,
      name: '',
      instance: data.instance || '',
      enableThreading: data.enableThreading || false,
      defaultVisibility: data.defaultVisibility || 'public',
      template: (data.templates && data.templates['zh-cn']) || null,
      emojiDone: data.emojiDone || '🔥',
      emojiEmpty: data.emojiEmpty || '⬜',
      habits: data.habits || [],
      accessToken: data.accessToken || null,
      clients: data.clients || {},
      quickTootSlot: null,
    };
    data = { sites: [site], activeSiteId: siteId };
  }

  let sites = stripCredentials ? data.sites.map(stripAuth) : data.sites.map(s => ({ ...s }));

  // 找出所有 enableThreading 为 true 但没有 token 的站点，
  // 将其 enableThreading 重置为 false，避免 UI 状态和实际授权不一致
  const needsAuth = [];
  sites.forEach(site => {
    if (site.enableThreading && !site.accessToken) {
      site.enableThreading = false;
      needsAuth.push(site.name || site.instance || '未知实例');
    }
  });

  chrome.storage.local.set(
    { sites, activeSiteId: data.activeSiteId },
    () => {
      _notifyImportResult(needsAuth);
      onSuccess && onSuccess();
    }
  );
}

/**
 * 覆盖单站点话题数据
 * 支持两种文件格式：
 *   - { siteBackup: { ...site } }  新版备份格式
 *   - { siteExport: { ...site } }  旧版兼容格式
 */
function _importSingleSite(imported, siteId, onSuccess) {
  const exportSite = imported.siteBackup || imported.siteExport;

  if (!exportSite || !exportSite.habits) {
    alert('文件格式不正确，请使用「备份此实例话题数据」生成的文件');
    return;
  }

  chrome.storage.local.get({ sites: [] }, data => {
    const sites = data.sites || [];
    const si = sites.findIndex(s => s.id === siteId);
    if (si === -1) return;

    // 只覆盖内容和配置字段，不触碰认证字段
    sites[si].habits            = exportSite.habits;
    sites[si].template          = exportSite.template;
    sites[si].emojiDone         = exportSite.emojiDone;
    sites[si].emojiEmpty        = exportSite.emojiEmpty;
    sites[si].defaultVisibility = exportSite.defaultVisibility;
    sites[si].quickTootSlot     = exportSite.quickTootSlot;

    chrome.storage.local.set({ sites }, () => {
      _notifyImportResult([]);
      onSuccess && onSuccess();
    });
  });
}

/**
 * 导入完成后的统一提示。
 * needsAuth: 需要重新授权的站点名称数组（来自 _importAllSites 的检测结果）
 *
 * 如果有站点需要重新授权，提示里直接告知用户下一步操作，
 * 而不是让用户面对「已启用串文」的 UI 却发不出嘟嘟。
 */
function _notifyImportResult(needsAuth) {
  if (needsAuth.length === 0) {
    alert('数据已成功导入');
    return;
  }

  const siteList = needsAuth.map(name => `  · ${name}`).join('\n');
  alert(
    '数据已成功导入。\n\n' +
    '以下实例需要重新授权才能发串文嘟嘟：\n' +
    siteList + '\n\n' +
    '请前往「当前实例设置」→ 勾选「启用串文」来完成授权。'
  );
}

/**
 * 静默验证所有站点的 accessToken 是否仍然有效（用于迁移导入后）。
 * 失效的站点同样重置 enableThreading 并提示用户重新授权。
 */
async function _verifyAllTokens() {
  const data = await chrome.storage.local.get({ sites: [] });
  const sites = data.sites.map(s => ({ ...s }));
  const invalid = [];

  await Promise.all(
    sites.map(async site => {
      if (!site.enableThreading || !site.accessToken || !site.instance) return;
      try {
        const res = await fetch(`${site.instance}/api/v1/accounts/verify_credentials`, {
          headers: { Authorization: `Bearer ${site.accessToken}` }
        });
        if (!res.ok) {
          site.enableThreading = false;
          invalid.push(site.name || site.instance);
        }
      } catch {
        // 网络错误时不打扰用户，静默跳过
      }
    })
  );

  if (invalid.length === 0) return;

  // 将失效站点的 enableThreading: false 写回 storage
  await chrome.storage.local.set({ sites });

  const siteList = invalid.map(name => `  · ${name}`).join('\n');
  alert(
    '以下实例的登录凭证已失效：\n' +
    siteList + '\n\n' +
    '请前往「当前实例设置」→ 勾选「启用串文」来重新授权。'
  );
}