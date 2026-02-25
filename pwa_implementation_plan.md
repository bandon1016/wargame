# PWA 導入實作計畫

本計畫旨在為「晶輝戰域 (War Realm)」導入 PWA (Progressive Web App) 技術，讓玩家可以將遊戲安裝到手機主畫面，並享受更流暢、接近原生 App 的體驗。

## 1. 準備工作
- [x] 安裝 `vite-plugin-pwa` 套件。
- [x] 生成高品質的遊戲圖示（採用 SVG 向量圖確保解析度）。

## 2. 核心配置
- [x] 設定 `vite.config.ts` 中的 PWA 插件。
- [x] 撰寫 Manifest 配置（名稱設定為：晶輝戰域 (War Realm)）。
- [x] 配置 Service Worker 以支援自動更新功能。

## 3. 資源與圖示
- [x] 在 `public/` 目錄下配置 `mask-icon.svg`。

## 4. 客戶端註冊
- [x] 配置 `vite-plugin-pwa` 的自動註冊機制。

## 5. UI 優化
- [x] 增加 meta 標籤以支援 iOS 全螢幕、隱藏狀態列顯示。
- [x] 優化 CSS 以防止系統性的捲動與文字選取衝突。
