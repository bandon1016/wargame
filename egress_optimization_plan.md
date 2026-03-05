# Supabase PostgREST Egress 暴增分析與改善計畫

您出示的圖表中，昨日的 **PostgREST Egress 達到 301.3MB**。這是非常龐大的流量流出（Server 傳送給 Client 的資料量），而兇手就藏在我們的「戰鬥自動探索」以及「戰鬥結算 RPC」中！

## 一、問題根源分析 (Root Cause)

1. **RPC 回傳了「整包玩家存檔」**
   在 `secure_resolve_combat` 的結尾，我們使用了這行回傳：
   ```sql
   RETURN jsonb_build_object(..., 'updated_profile', row_to_json(v_p));
   ```
   `row_to_json(v_p)` 會將整張 `profiles` 資料表該角色的所有欄位序列化回傳。這其中包含了極度龐大的 JSON 陣列：`items` (道具)、`equipment` (裝備)、`partners` (夥伴)、`skills` (技能)、`buildings` (建築)。
   隨著遊戲進行，一個進階玩家的存檔 JSON 大小可能高達 **50KB ~ 100KB**。

2. **「自動探索」的高頻率乘數效應**
   遊戲中的「自動探索 (Auto Explore)」每隔幾秒就會自動發起一場戰鬥並呼叫 `secure_resolve_combat`。
   - 假設每場結算封包大小 = 100KB
   - 假設自動探索每 5 秒打完一隻怪 = 1 分鐘 12 場 = 1 小時 720 場
   - 單一玩家掛機 1 小時 = 720 * 100KB = **72 MB**
   - 掛機 4~5 小時，單日單人網路流出量就直接突破 **300 MB**！

這就是為什麼在您昨天測試自動探索與戰鬥結算功能時，流量會呈現直線飆升的原因。

---

## 二、改善計畫 (Action Plan)

要解決這個問題，我們必須從「送出整包資料」轉變為「只送出變更點 (Delta)」。

### 1. 後端 (Supabase SQL) 優化
修改 `secure_resolve_combat` 函數，**完全移除 `updated_profile: row_to_json(v_p)` 的回傳**。
- RPC 只需要回傳：`gold` (獲得金幣), `exp` (獲得經驗), `leveled_up` (是否升級), `new_level` (新等級), `loots` (掉落物清單)。
- **預期效果**：單次戰鬥 API 回應封包將從 100KB 驟降到不到 0.5KB（節省 99% 頻寬）。

### 2. 前端 (React App.tsx) 邏輯解耦
目前 `App.tsx` 依賴後端傳回的整包資料來同步畫面：
```typescript
if (result.updated_profile) {
    const newP = mapServerProfile(result.updated_profile);
    setPlayer(newP); // 直接覆蓋
}
```
**我們需要將其改寫為：**
前端接收到戰鬥結果後，**自己去組合**現有的狀態。
- 將 `result.loots` 自己寫入現有的 `items` 陣列中。
- 將 `result.exp` 自行加上目前的 `player.exp`。
- 這樣前端的畫面一樣能即時更新，但完全不需要後端把 100 個舊道具再傳回給前端一次。

### 3. 將資料庫寫入解耦 (未來擴充性考量)
雖然移除了回傳，但後端每次戰鬥還是會執行 `UPDATE profiles`。未來如果玩家數量變多，高頻率的 UPDATE 仍會消耗 DB I/O。下一個階段的最佳化會是：
- 戰鬥都在前端打與結算（收集 Loot）。
- 前端累積了 30 秒的戰鬥結果後，只發送**一次** `sync_combat_batch` 給後端更新資料庫。

---

## 下一步
目前最急迫也最有效的改動是 **1 與 2**。
只要修改 SQL 拔掉回傳，以及微調 `App.tsx` 處理 Loots 的拼湊邏輯，就能立刻把流量壓回 1MB 以下。

請問您希望我現在立刻開始為您修改 `App.tsx` 和 SQL 的這兩個區塊嗎？
