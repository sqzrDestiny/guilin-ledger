# 项目说明

这是一个 React + Vite + Tailwind 的旅行账本网页 App。

项目路径：
D:\xiangmu\guilin-ledger

主要文件：
- src/App.jsx：当前几乎所有核心代码都在这里
- src/index.css：Tailwind 引入
- vite.config.js：Vite + React + Tailwind 配置
- dist：npm run build 生成的部署文件夹，不要手动改

当前功能：
- 记录桂林之行账单
- 三个参与人：我、小黄、小段
- 支持 AA / 不 AA
- 支持添加、删除、行内编辑消费
- 金额输入框支持简单表达式，例如 8-1、10/2、8+3
- 支持筛选全部 / AA / 不AA
- 支持行程记录
- 支持本地 localStorage 保存
- 支持导出 JSON、CSV、纪念图
- 已经可以 npm run build，并通过 Netlify 手动上传 dist 部署

重要规则：
- 不要改 STORAGE_KEY，避免用户本地数据丢失
- 不要上传或写入真实账单备份 JSON / CSV
- 不要删除现有功能
- 不要大规模重构，除非我明确要求
- 每次改动后，请说明改了哪些文件、哪些功能受影响
- 改完后建议运行 npm run build 检查是否有错误

常用命令：
- npm run dev：本地开发预览
- npm run build：正式打包
- npm run preview：预览 dist 正式版