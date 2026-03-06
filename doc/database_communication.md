本文件詳述《浪跡戰域》前端 React 應用程式與後端 Supabase (PostgreSQL) 資料庫之間的通訊協議、同步策略以及安全限制。

> [!TIP]
> 關於系統整體的技術架構、效能優化指標以及 PWA 實作細節，請參閱：[technical_specs.md](file:///c:/Users/werbo/Desktop/gravity/github/war-game/doc/technical_specs.md)。

---

## 1. 數據同步策略 (Synchronization Strategy)

為了平衡遊戲體驗與伺服器負擔，系統採用了三層式的「水合與差異同步」架構。

### A. 資料正規化與水合 (Normalization & Hydration)
*   **儲存端 (Database)**: JSONB 欄位僅儲存變動數據（如 `id`, `level`, `quantity`），不儲存靜態文字、圖片路徑或描述。
*   **前端水合 (Hydration)**: 從資料庫載入數據時，前端會透過 `src/data/` 字典將 ID 映射回完整的 Object，補全顯示所需的 UI 資訊。
*   **效益**: 減少資料庫體積 70%，節省極大網路傳輸量。

### B. 細粒度差異化同步 (Granular Selective Sync)
*   **Hash 追蹤**: 前端使用 `useRef` 監控夥伴、道具、裝備等大型陣列。
*   **跳過對傳**: 呼叫 `secure_sync_profile` 時，僅傳入變動的陣列。若該欄位無變動則傳傳入 `null`，SQL 內部使用 `COALESCE(p_field, field)` 保持原值。

### C. 分級傳輸 RPC
1.  **Full Sync**: 進入遊戲或發生重大變更時，傳送所有輕重數據。
2.  **Selective Sync (Auto-save)**: 每 5 秒自動存檔，僅傳送位移與變動部分，其餘帶 `null`。
3.  **Minimal Sync (`secure_sync_location`)**: 單純走動時專用，Payload 低於 300 Bytes，不包含任何 Null Key。

---

## 2. RPC 正規化與安全性 (RPC Normalization & Security)

針對關鍵操作，系統完全捨棄 PostgREST 直連，改用封裝的 **Stored Procedures (RPC)**。

### A. 原子化操作 (Atomic Operations)
關鍵邏輯（如裝備、戰鬥結算、合成）完全由資料庫 SQL 執行：
*   **核能級清理 (Nuclear Cleanup)**: 定期清理資料庫中的過載 (Overloading) 簽名，確保每個 RPC 僅有無歧義的唯一簽名。
*   **安全性檢查**: 每個 RPC 開頭均驗證 `auth.uid() = p_user_id`，防止越權操作。
*   **數值規範**: 所有數值參數統一採用 `numeric` 並由伺服器端 `floor()` 取整，杜絕前端傳入浮點數導致的類型錯誤。

### B. 權威性回傳 (Authoritative Return)
重要修改（如 `secure_synthesis` 或 `secure_resolve_combat`）不僅回傳結果，更會主動回傳更新後的 `updated_profile`。前端收到後立即採用伺服器版本水合回全域狀態，修正任何前端預測的誤差。

---

## 3. 安全與防護機制 (Protection Mechanisms)

### A. 多開防護 (Anti-Multi-Tab)
*   **Session Lock**: `profiles` 表維護一個 `session_id`。
*   **搶佔機制**: 登入遊戲時透過 `secure_claim_session` 寫入當前 UUID。
*   **即時偵測**: 前端監聽 Realtime 頻道，一旦發現 `session_id` 被他處覆蓋，立即中斷所有存檔功能。

### B. 追蹤保護 (Tracking Integrity)
*   **任務判定**: 戰鬥進度（如擊殺數量、採集物品）由 `secure_resolve_combat` 等後端 RPC 主動觸發任務表更新，前端僅負責顯示，無法偽造進度。
*   **座標修正**: 針對地區任務（如高雄、新北），資料庫會依據傳入的 `p_lat/p_lng` 進行後端界定，而非依賴前端傳送的地區字串。

---

## 4. 關鍵 RPC 配置清單

| 功能名稱 | RPC 函數名 | 傳輸重點參數 |
| :--- | :--- | :--- |
| **資料同步** | `secure_sync_profile` | `numeric` 類型的 HP/MP/Gold, 差異化 JSONB |
| **戰鬥結算** | `secure_resolve_combat` | 掉落規則、任務觸發、 authoritative 經驗值計算 |
| **夥伴合成** | `secure_synthesis` | 素材 ID 陣列檢核、50+ 種夥伴資料池判定 |
| **任務板** | `get_or_reset_daily_quests` | 定期重置、資料庫端權威生成隨機池 |
| **領取獎勵** | `claim_quest_reward` | 獎勵發放原子化 (Gold/Incense/Items) |

## 5. 更新紀錄 (Update Log)
- **2026-03-06** - 建立文件，詳述前後端溝通協議、差異化同步策略及 RPC 安全規範。
