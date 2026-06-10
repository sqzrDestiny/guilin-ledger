# 旅行账本

一个轻量的通用旅行 / 多人 AA 记账工具。适合朋友旅行、聚餐、短途出行时记录共同账单，快速算清谁付了钱、谁该承担多少、最后谁应该给谁多少钱。

在线体验：[旅行账本](https://chimerical-macaron-9ddac7.netlify.app)

## 适合什么场景

- 几个人一起出去玩，消费由不同成员轮流垫付
- 一笔消费只需要部分成员 AA，例如两个人买票、三个人打车
- 旅行结束后想快速得到结算建议
- 想把账单导出为图片、CSV 或 JSON 备份
- 不想注册账号，只想打开网页直接使用

## 核心功能

- 多账本管理：不同旅行或活动可以创建独立账本
- 自定义成员：每个账本维护自己的参与成员
- AA 分摊：每笔账单可选择付款人和参与分摊成员
- 个人消费：非 AA 账单只计入付款人个人消费
- 结算建议：自动计算成员实际支付、应承担、应收应付
- 分类统计：内置旅行常用分类，也支持自定义分类
- 每日统计：查看每天消费金额
- 移动端记账：手机端支持底部“记一笔”抽屉表单
- 本地保存：数据保存在当前浏览器 `localStorage`
- 导出分享：支持导出 JSON、CSV 和分享图片

## 数据和隐私

当前版本没有登录、云同步、服务器或数据库。所有账本数据默认保存在当前浏览器本地。

注意：

- 更换设备、清理浏览器数据或换浏览器前，请先导出 JSON 备份
- 分享链接不会自动同步你的账本数据
- `travel-ledger-app-v2` 是当前主数据存储 key
- `guilin-trip-ledger-v1` 仅用于检测和导出旧版数据

## 技术栈

- React
- Vite
- Tailwind CSS
- Vitest
- html2canvas
- lucide-react
- framer-motion

## 本地运行

```bash
npm install
npm run dev
```

开发服务启动后，按终端提示打开本地地址。

## 测试和构建

```bash
npm run test:run
npm run lint
npm run build
```

说明：

- `npm run test:run`：运行核心 AA 计算测试
- `npm run lint`：运行静态检查
- `npm run build`：生成正式部署产物

## 部署

项目是纯前端静态应用。执行：

```bash
npm run build
```

生成的 `dist` 目录可以部署到 Netlify、Vercel、GitHub Pages 或其他静态网站服务。

## 项目结构

```text
src/
  App.jsx              # 页面、表单、账本管理、导入导出和 UI 交互
  calculations.js      # 金额解析、AA 分摊、统计和结算建议
  calculations.test.js # 核心计算逻辑测试
  defaults.js          # 默认分类、默认账本和本地存储 key
  main.jsx             # React 入口
  index.css            # Tailwind 引入
public/
  favicon.svg
  manifest.webmanifest
```

## 后续方向

- 优化分享图片样式
- 增加一键复制结算文案
- 完善 PWA 离线能力
- 增强导入导出体验
- 保持轻量，不引入复杂财务系统
