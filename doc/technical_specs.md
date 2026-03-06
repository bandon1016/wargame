本文件詳述《浪跡戰域》中的核心技術實現、效能優化手段以及系統架構設計。

> [!NOTE]
> 關於前端與後端資料庫溝通的詳細技術協議（如 RPC 簽名、同步權威、Session 鎖定細節），請參閱：[database_communication.md](file:///c:/Users/werbo/Desktop/gravity/github/war-game/doc/database_communication.md)。

---

## 1. 網路傳輸優化：差異化同步 (Selective Sync)

為了解決頻繁存檔（每 5 秒一次）對伺服器造成的負擔，我們實作了差異化同步機制。

*   **核心理念**：僅傳送變動的 JSON 陣列，其餘欄位設為 `null` 並由 SQL 內部合併。
*   **細粒度優化**：將夥伴、裝備、道具等獨立比對快照，確保單次變動僅傳送對應陣列。
*   **優化結果**：單純行走時的 Payload 降低至 **1 KB 以下**，節省了約 **85%** 的傳輸頻寬。

---

## 2. 進階效能優化：極簡同步 (Minimal Sync)

針對高頻率呼叫的特性，我們實施了靜止偵測與專用的極簡 RPC。

*   **靜止偵測**：位移極小時跳過存檔，僅保留 60 秒一次的心跳同步。
*   **極簡 RPC (`secure_sync_location`)**：當判定僅有位移時，使用特製 RPC，Payload **< 300 Bytes**。

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

## 6. 資料數據正規化與水合 (Data Normalization & Hydration)

為了提升維護性並進一步優化頻寬，實作了「字典水合」機制。

*   **效益**：JSON 陣列大小縮減約 70%，更新道具數值只需修改前端字典，無需更動資料庫。
*   **權威性**：後端 SQL 同樣採用 ID 對應邏輯（如建築產能計算），確保計算基準與前端一致。

---

> [!IMPORTANT]
> 關於 RPC 的正規化更新（2026-03-06）詳細內容，請見 [database_communication.md](file:///c:/Users/werbo/Desktop/gravity/github/war-game/doc/database_communication.md) 第 2 節。

---

## 7. 更新紀錄 (Update History)
- **2026-03-06** - 解決 RPC 重複定義問題，修復夥伴合成 400 錯誤與 Profile 同步邏輯。
- **2026-03-06** - 補全任務追蹤邏輯（城市週常、採集任務、擊殺判定範圍修正）。
- **2026-03-06** - 實作資料數據正規化 (Data Normalization)，將 JSON 陣列轉為 ID 導向的輕量結構。
- **2026-03-06** - 實作細粒度差異化同步 (Granular Selective Sync)。
- **2026-03-05** - 實作進階同步優化（靜止偵測、極簡 RPC）。
- **2026-03-02** - 實作 `session_id` 多開防護機制。
