# 🚀 R Instant Preview - 发布指南

## 📋 预发布检查表 ✅

所有项目已完成：

```
✅ package.json 更新完成 (name, displayName, icon 等)
✅ README.md 完整编写 (功能、使用、要求)
✅ 图标文件已创建 (images/icon.png)
✅ .vscodeignore 已优化 (包大小 43.89 KB)
✅ 所有测试通过 (smartContext + incrementalExecution)
✅ 代码编译成功 (0 errors)
✅ VSIX 包已生成 (r-instant-preview-0.1.0.vsix)
```

## 🎯 一键发布步骤

### 第 1 步：获取 Personal Access Token (PAT)

1. 打开 https://dev.azure.com/
2. 点击左上角的 "Azure DevOps"
3. 转到 "Personal access tokens"
4. 点击 "New Token"
5. 填写信息：
   - Name: `vscode-marketplace-publish`
   - Organization: 选择你的 org
   - Scopes: 选择 "Marketplace" → "Manage"
6. 点击 "Create"
7. **复制令牌**（只显示一次！）

### 第 2 步：发布到 Marketplace

**方式 A：使用 PAT 直接发布**

```powershell
# 在 PowerShell 中执行：
cd D:\vibe_coding\test1
$env:VSCE_PAT="粘贴你的PAT令牌"
npx @vscode/vsce publish
```

**方式 B：使用提示输入（推荐）**

```powershell
cd D:\vibe_coding\test1
npx @vscode/vsce publish
# 系统会提示输入 PAT 令牌
```

**方式 C：手动上传 VSIX**

1. 访问 https://marketplace.visualstudio.com/
2. 点击 "Publish extensions"
3. 上传文件 `r-instant-preview-0.1.0.vsix`
4. 填充信息（会自动从包中读取）
5. 点击 "Create"

## 📊 当前包信息

```json
{
  "name": "r-instant-preview",
  "displayName": "R Instant Preview",
  "version": "0.1.0",
  "publisher": "linxiangsun145",
  "icon": "images/icon.png",
  "engines": {
    "vscode": "^1.90.0"
  },
  "vsix": "r-instant-preview-0.1.0.vsix",
  "size": "43.89 KB",
  "files": 23
}
```

## ✨ 发布后验证

1. **Marketplace 列表**
   - 访问 https://marketplace.visualstudio.com/publishers/linxiangsun145
   - 应该看到你的扩展列表

2. **VS Code 中搜索**
   - 打开 VS Code
   - 打开扩展面板 (Ctrl+Shift+X)
   - 搜索 "R Instant Preview"
   - 点击 "Install"

3. **验证功能**
   ```r
   # 在 VS Code 中创建 test.R 文件
   x <- c(1, 2, 3)
   mean(x)  # 应该看到内联结果：[1] 2
   ```

## 🔄 版本更新流程

**发布下一个版本 (0.2.0) 时：**

1. 更新 `package.json` 中的 version: `"0.2.0"`
2. 更新 `README.md` 的新增功能说明
3. 在 git 中创建新 tag: `git tag v0.2.0`
4. 推送更改到 GitHub
5. 运行 `npm run vscode:prepublish`
6. 运行 `npx @vscode/vsce publish`

## ⚠️ 常见问题

**Q: 发布失败，说"需要 marketplace scope"？**
A: 检查 PAT 令牌是否包含 "Marketplace: Manage" 权限。

**Q: 包太大了（超过 100 MB）？**
A: 检查 `.vscodeignore` 是否正确排除了 node_modules、src 等。

**Q: 发布成功但没有显示在 Marketplace？**
A: 可能需要 1-24 小时才能显示。访问你的发布者页面确认。

**Q: 如何撤销发布？**
A: 在 Marketplace 上选择扩展，点击 "Deprecate"（不完全删除）或联系 VS Code 支持。

## 🎉 发布成功！

一旦扩展发布成功，用户就可以：
- 在 VS Code Marketplace 中找到你的扩展
- 一键安装
- 自动获得更新

## 📌 后续维护

- 监听用户评论和反馈
- 定期发布修复和功能更新
- 保持 README 和文档的最新状态
- 在 GitHub 上管理 Issues

---

**需要帮助？**
- VS Code 扩展文档：https://code.visualstudio.com/api
- VSCE 工具：https://github.com/microsoft/vscode-vsce
- Marketplace：https://marketplace.visualstudio.com/
