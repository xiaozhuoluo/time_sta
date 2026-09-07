# 日日有迹

一个个人使用的每日 Todo 与时间记录网站。支持任务打勾、实时计时、手动补录、自动顺延、重复任务、分类标签、日历、周/月/季度统计，以及 CSV/JSON 导出。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。没有配置 Supabase 时，网站使用浏览器本地存储，并自动载入少量示例数据方便体验。

## 连接 Supabase

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 `supabase/migrations/202609070001_initial_schema.sql`。
3. 在 Authentication 设置中关闭公开注册，然后手动创建自己的邮箱密码账号。
4. 复制 `.env.example` 为 `.env.local`，填写项目 URL、公开 anon key 和允许登录的邮箱：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_ALLOWED_EMAIL=you@example.com
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Supabase anon key 可以出现在浏览器端；真正的服务端密钥不应写入这个项目。数据库中所有业务表都启用了行级权限，登录者只能访问自己的数据。

## 检查项目

```bash
npm test -- --run
npm run lint
npm run build
```

## 发布到 GitHub 和 Vercel

1. 把当前 Git 仓库推送到你的 GitHub 空仓库。
2. 在 Vercel 导入该仓库。
3. 在 Vercel 项目设置中添加与 `.env.local` 相同的三个环境变量。
4. 完成首次部署后，在 Vercel 的 Domains 设置中添加你的独立域名，并按提示配置 DNS。

每次向 GitHub 的生产分支推送后，Vercel 都会自动构建并发布新版本。
