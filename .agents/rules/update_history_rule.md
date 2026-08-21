# 📜 Auto Update History Rule

Whenever any code changes, UI adjustments, bug fixes, or new features are implemented in response to user requests:

1. **Auto-update `UPDATE_HISTORY.md`**:
   - Always append the new update entry into `UPDATE_HISTORY.md` in the workspace root (`d:\mimo-tts-studio-main\UPDATE_HISTORY.md`).

2. **Section 1: Verbatim Request Log**:
   - Record the user's exact input prompt under `## 💬 一、 原始用户对话与需求逐条归档`.

3. **Section 3: Standard Changelog Structure**:
   - Add a new version entry under `## 📅 三、 全量版本更新明细记录` containing BOTH:
     - `#### 1. 需求与问题`
     - `#### 2. 实现内容`
