-- 重要：確保 profiles 資料表支援完整 Realtime 通知
-- 請在 Supabase SQL Editor 執行以下內容：

-- 1. 確保欄位存在
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_id UUID;

-- 2. 開啟全欄位複寫模式 (非常重要，否則 Realtime Payload 中將不含 session_id)
ALTER TABLE profiles REPLICA IDENTITY FULL;

-- 3. 確保 profiles 有啟用 Realtime
-- 完成 SQL 後，請至 Supabase Dashboard -> Database -> Replication 確保 profiles 已勾選 Enable。
