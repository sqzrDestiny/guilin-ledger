# 项目说明

这是一个 React + Vite + Tailwind 的通用旅行 / 多人 AA 记账网页 App。

项目路径：
D:\xiangmu\jizhang\guilin-ledger

## 主要文件

- `src/App.jsx`：主要页面、表单、账本管理、导入导出和 UI 交互
- `src/defaults.js`：本地存储 key、默认分类、默认账本和成员初始化
- `src/calculations.js`：金额解析、AA 分摊、成员统计、结算建议
- `src/calculations.test.js`：核心计算逻辑测试
- `src/index.css`：Tailwind 引入
- `index.html`：网页标题、描述、favicon 和 manifest
- `public/manifest.webmanifest`：PWA/安装名称和图标信息
- `vite.config.js`：Vite + React + Tailwind 配置
- `dist`：`npm run build` 生成的部署文件夹，不要手动改

## 当前功能

- 支持创建和切换多个旅行账本
- 支持每个账本自定义成员
- 支持默认和自定义分类
- 支持添加、删除、编辑账单
- 支持选择付款人
- 支持 AA 分摊并选择参与成员
- 支持非 AA / 个人消费
- 支持分类统计、每日统计、成员应收应付统计
- 支持结算调整和最终结算建议
- 支持行程记录
- 支持本地 `localStorage` 保存
- 支持导出 JSON、CSV 和分享图片
- 支持导入新版 JSON 备份

## 数据规则

- 主存储 key 是 `travel-ledger-app-v2`
- 旧存储 key `guilin-trip-ledger-v1` 仅用于检测和导出旧数据
- 不要随意改存储 key，避免用户本地数据丢失
- 不要上传或写入真实账单备份 JSON / CSV
- 当前不包含登录、云同步、服务器或数据库

## 开发规则

- 不要删除现有可用功能
- 不要大规模重构，除非用户明确要求
- 不要在稳定阶段拆分 `App.jsx`
- 修改后说明改了哪些文件、哪些功能受影响
- 修改后优先运行 `npm run test:run`、`npm run lint`、`npm run build`

## 常用命令

- `npm run dev`：本地开发预览
- `npm run test:run`：运行核心测试
- `npm run lint`：静态检查
- `npm run build`：正式打包
- `npm run preview`：预览 `dist` 正式版
