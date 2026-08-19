# 禾十七 Travel Content Studio

正式版云端工作台，目标是固定网址、手机/电脑实时同步、旅行素材云端管理、选题流水线、内容制作、小红书链接关联、数据快照与独立站候选池。

## 技术架构

- Next.js
- Supabase Auth / Postgres / Realtime / Storage
- GitHub Pages（固定网址）
- PWA Web App

## 功能

- 邮箱 Magic Link 登录
- 旅行素材库
- 选题：选题 → 制作中 → 待发布 → 已发布
- 内容草稿云端保存
- 绑定小红书笔记 URL / Note ID
- 24h / 7d / 任意时间点数据快照
- 手机、电脑跨设备实时更新
- 独立站候选内容池
- PWA，可添加到手机主屏幕

## 小红书关联说明

V1 使用小红书笔记 URL / Note ID 绑定，以及手动/半自动录入创作中心数据快照；不做未经授权的页面爬取。后续如账号获得官方可用的数据接口权限，再接官方接口。

## Supabase 初始化

1. 新建 Supabase 项目。
2. SQL Editor 运行 `supabase/schema.sql`。
3. Storage 新建私有 Bucket：`travel-media`。
4. Authentication → URL Configuration，把正式域名加入 Redirect URLs。
5. Project Settings → API 获取 Project URL 与 anon public key。

## GitHub Pages 固定网址

仓库启用 GitHub Pages 并选择 GitHub Actions 作为 Source 后，每次推送 main 都会自动构建。
默认网址：

`https://hssalways233-lab.github.io/h17-travel-studio/`

手机和电脑访问同一网址时，通过 Supabase 实时同步数据。
