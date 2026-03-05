# 技術架構與效能優化說明文件 (Technical Architecture & Optimizations)

本文件詳述《浪跡戰域》中的核心技術實現、效能優化手段以及系統架構設計細節，供開發團隊參考與後續維護使用。

---

## 1. 網路傳輸優化：差異化同步 (Selective Sync)

為了解決頻繁存檔（每 5 秒一次）對伺服器造成的頻寬壓力與資料庫解析負擔，我們實作了差異化同步機制。

### 問題背後
*   **數據量膨脹**：玩家檔案包含夥伴 (Partners)、道具 (Items)、裝備 (Equipment) 等多個大型 JSON 陣列。
*   **原先狀況**：每次移動或定期存檔時，不論資料是否變更，前端都會傳送完整的玩家檔案（約 5.5 KB - 10 KB）。
*   **負擔**：在高併發下，會造成嚴重的 Outbound 流量與資料庫 CPU 解析負擔。

### 解決方案
*   **追蹤參照 (`lastSyncedHeavyDataRef`)**：在前端使用 `useRef` 記錄上一次成功同步的「重型數據」快照（Stringified JSON）。
*   **差異判定**：在 `saveProfile` 調用前，先將目前的重型數據與快照比較。
*   **按需傳輸**：
    *   若**無變動**（例如單純在走路）：RPC 僅傳送 `lat, lng, hp, mp` 等輕量數據，其餘欄位設為 `null`。
    *   若**有變動**（例如獲得道具、升級建築）：才傳送完整的玩家檔案。
*   **優化結果**：單純行走時的 Payload 降低至 **1 KB 以下**，節省了約 **85%** 的頻寬。

---

## 2. 進階效能優化：靜止偵測與極簡同步 (Advanced Sync Optimizations)

針對 `secure_sync_profile` 高頻率呼叫的特性，我們實施了更深層的優化：

### 靜止偵測 (Stationary Detection)
系統會比對目前位置、HP、MP 與上一次同步成功的數值。
*   **抑制機制**：若位移 < 0.5m 且數值變動極小，則完全**跳過**本次同步請求。
*   **心跳機制 (Heartbeat)**：即使處於靜止狀態，每 60 秒仍會強制進行一次存檔，以維持伺服器 Session 與資料庫 `updated_at` 的新鮮度。

### 極簡位置同步 RPC (`secure_sync_location`)
當系統判定玩家僅是在移動（無重型數據變更、無火車/步行路徑更新）時，會切換至此專門的 RPC。
*   **極小型 Payload**：僅傳送基本座標與狀態，不包含任何 JSON Null Key。
*   **效能分級**：
    *   **Full Sync**：數據變更或狀態切換時使用。
    *   **Selective Sync**：定期自動存檔但數據未變時使用（傳送 Null Key）。
    *   **Minimal Sync**：純位移時使用，Payload **< 300 Bytes**。

---

## 3. 安全防護：多開防護系統 (Anti-Multi-Tab System)

為防止玩家透過在多個分頁或裝置同時進行遊戲來洗資源（例如同時在多地遇敵），我們實作了 Session 級別的鎖定機制。

### 核心機制
1.  **Session ID 生成**：每次載入遊戲時，前端會生成一個唯一的 `mySessionId` (UUID)。
2.  **資料庫鎖定**：`profiles` 表中設有 `session_id` 欄位。
3.  **握手與驗證**：
    *   首次載入時，透過 `secure_claim_session` RPC 嘗試將目前的 `sessionId` 寫入資料庫。
    *   若該帳號已有其他 Session 被判定為「活躍中」，則拒絕連線。
4.  **定期檢查**：前端會監聽 Supabase 的 `REALTIME` 更新，若發現資料庫中的 `session_id` 變更為非本機 ID，則立即觸發「異地登入/多開」警告並切斷操作權限。

---

## 3. 同步策略與資料庫權威性 (Consistency & Authority)

遊戲遵循「伺服器為最終權威」的原則，但為了流暢感，部分狀態在前端會先進行預測。

### 權威同步基準
*   **Timestamp-based Locking**：每次 RPC 更新都會回傳伺服器端的 `updated_at` (Timestamp)。
*   **版本檢查**：`secure_sync_profile` 包含樂觀鎖定邏輯。若前端傳入的 `p_last_updated_at` 與資料庫相差太大，則視為衝突，系統僅會同步位置與血量，保護敏感數據不被舊版本覆寫。

### 延遲保存與防抖 (Debounce & Throttle)
*   **移動防抖**：當玩家頻繁點擊地圖時，使用 500ms 的防抖 (Debounce) 以免產生過多負擔。
*   **自動存檔**：每 5 秒進行一次節流 (Throttled) 同步，確保即使非預期斷線，資料回溯也不會超過 5 秒。

---

## 4. PWA 技術架構 (Progressive Web App)

《浪跡戰域》作為一個 PWA，其離線處理與通知系統是技術重點。

### 核心組件
*   **Service Worker (`sw.ts`)**：
    *   負責靜態資源快取。
    *   監控 `push` 事件並解析 Payload 顯示通知。
*   **推播通知流程**：
    1.  玩家在設定介面開啟通知。
    2.  前端獲取 VAPID 訂閱對象 (Subscription)。
    3.  訂閱對象儲存於資料庫的密鑰加密欄位。
    4.  當伺服器觸發事件（如抵達城市）時，調用 Supabase Edge Functions 發送 Web Push API 請求。

---

## 5. 資料庫效能優化 (DB Performance)

*   **JSONB 索引**：針對 `profiles` 表中的 `equipped_weapon` 等經常查詢的 JSON 欄位建議建立 GIN 索引。
*   **RPC 層級邏輯**：將戰鬥、鍊金、升級等「寫入型」邏輯完全封裝在 SQL (PL/pgSQL) 中，減少前端傳輸原始數據與防止計算作弊。
*   **預儲程序 (Prepared Statements)**：在高頻率操作（如遇敵）中使用 RPC 而非直接調用 PostgREST 操作表，能更有效利用資料庫連線池。

---

## 更新紀錄 (Update History)
*   **2026-03-05**：實作進階同步優化（靜止偵測、極簡 RPC），將純位移傳輸降低至 < 300 Bytes。
*   **2026-03-05**：實作差異化同步優化，顯著降低 5s 定期存檔的數據量。
*   **2026-03-02**：實作 `session_id` 多開防護機制。
*   **2026-02-25**：PWA 通知系統架構確立。
