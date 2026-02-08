

## 文件结构

```
/
├── popup.html                 # 主界面 HTML
├── popup.js                   # 主文件
├── popup.css                  # 样式文件
├── manifest.json              # 扩展配置文件
├── background.js              # 后台脚本
├── utils.js                   # 工具函数
├── templates.js               # 模板生成函数
├── locales.js                 # 多语言本地化
├── thread-editor/
│   └── thread-editor.html     # 串文编辑器 HTML
│   └── thread-editor.js       # 串文编辑器脚本
│   └── thread-editor.css      # 串文编辑器样式
├── scripts/
│   └── locale-manager.js      # 语言本地化管理
│   └── habit-manager.js       # 习惯数据管理
│   └── modal-manager.js       # Modal窗口管理
│   └── data-import-export.js  # 数据导入导出
│   └── keyboard-handler.js    # 键盘导航和事件处理
│   └── ui-renderer.js         # UI渲染和列表管理
├── icons/
│   └── icons.js               # 图标数据
└── locales/
    ├── zh-cn.js               # 简体中文
    ├── zh-tw.js               # 繁體中文
    ├── en-us.js               # English
    └── jp.js                  # 日本語
```

## 模块说明

### locale-manager.js (语言本地化)
**导出函数:**
- `getCurrentLang()` - 获取当前语言设置
- `setActiveLangButton(lang)` - 设置活跃语言按钮
- `normalizeLang(lang)` - 规范化语言代码
- `applyLocale(lang, templates)` - 应用语言到UI

### habit-manager.js (习惯管理)
**导出函数:**
- `normalizeInstance(input)` - 规范化实例地址
- `validateAndNormalizeInstance(input)` - 验证实例地址
- `calcStreak(records)` - 计算连续天数
- `buildHeatmap(records, done, empty)` - 生成热力图
- `deleteHabitById(id, callback)` - 删除习惯
- `moveHabitById(id, dir, onSuccess)` - 移动习惯位置
- `isHabitDoneToday(habit)` - 检查今日是否完成

### modal-manager.js (Modal窗口管理)
**导出函数:**
- `trapFocus(modalElement)` - 焦点陷阱（焦点循环）
- `showModal(overlayId)` - 显示Modal并调整窗口高度
- `hideModal(overlayId)` - 隐藏Modal并恢复高度
- `focusModalInput(modalId)` - 自动聚焦Modal内的输入框

### data-import-export.js (数据导入导出)
**导出函数:**
- `exportData()` - 导出数据为JSON
- `importData(file, onSuccess)` - 导入JSON数据

### keyboard-handler.js (键盘处理)
**导出函数:**
- `initKeyboardNavigation()` - 初始化键盘导航（↑↓Enter）
- `initFocusScroll()` - 初始化焦点滚动
- `initNewHabitFocusScroll()` - 初始化新习惯输入框焦点滚动
- `setupEnterKeySubmit(inputSelector, buttonSelector)` - Enter键提交

### ui-renderer.js (UI渲染)
**导出函数:**
- `renderHabitList(...)` - 渲染习惯列表
- `hideAllHabitMenus()` - 隐藏所有菜单
- `manageFocus(...)` - 焦点管理
- `updateWindowHeight()` - 更新窗口高度
- `initResizeObserver()` - 初始化窗口观察器
- `updateSettingsDisplay(data)` - 更新设置显示

