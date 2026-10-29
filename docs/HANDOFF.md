# 部署状态 - 2026-10-29

## ✅ 已完成

- GitHub 仓库: `18617849364/marugoto-listening` (公开)
- GitHub Pages: 已开启并构建成功
- 内容: 385 个音频 + 147 张课本图 + 完整网页
- 学生访问地址: https://18617849364.github.io/marugoto-listening/web/index.html

## 部署细节

- 总大小约 305MB，分成 30+ 次小 push 完成（每次 ~5-10MB）
- 绕过了代理对长连接的限制
- marugoto_a1.pdf (29M) 未上传（网页只用 pdf_pages/ 的逐页图，不需要 PDF 本体）

## 后续维护

如果以后改内容：
```bash
cd "/Users/sylvan/Documents/ChatGPT/日语教学 2"
git add <changed files>
git commit -m "..."
git push --force origin HEAD:main
```
