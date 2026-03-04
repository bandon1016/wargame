-- ==========================================
-- 排行榜修復腳本：自動排程 + 立即刷新
-- ==========================================
-- 請在 Supabase SQL Editor 中執行本腳本

-- Step 1: 確認 pg_cron 擴充套件已啟用 (Supabase 通常預設啟用)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: 確認 refresh_leaderboard_snapshots 函式已是最新版本
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_snapshots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today date := current_date;
    v_count integer;
BEGIN
    -- 清除今日已存在的快照 (避免重複執行時產生多餘資料)
    DELETE FROM public.leaderboard_snapshots WHERE snapshot_date = v_today;

    -- 插入等級榜
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id, nickname, level, gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'level' as rank_type,
        row_number() OVER (ORDER BY level DESC, exp DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY level DESC, exp DESC
    LIMIT 100;

    -- 插入財富榜
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id, nickname, level, gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'gold' as rank_type,
        row_number() OVER (ORDER BY gold DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY gold DESC
    LIMIT 100;

    -- 插入戰力榜
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id, nickname, level, gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'power' as rank_type,
        row_number() OVER (ORDER BY (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100) DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100) DESC
    LIMIT 100;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'snapshot_date', v_today,
        'rows_inserted', v_count,
        'message', '排行榜快照已更新至 ' || v_today
    );
END;
$$;

-- Step 3: 移除所有舊的排行榜排程（避免重複）
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname LIKE '%leaderboard%';

-- Step 4: 建立新的排程（每天 UTC 00:00，台灣時間 08:00 更新）
SELECT cron.schedule(
    'refresh-leaderboard-daily',    -- 排程名稱
    '0 0 * * *',                    -- cron 表達式：每天 UTC 00:00
    $$SELECT public.refresh_leaderboard_snapshots();$$
);

-- Step 5: 立即手動執行一次，確認功能正常
SELECT public.refresh_leaderboard_snapshots();

-- Step 6: 驗證排程已建立
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'refresh-leaderboard-daily';

-- Step 7: 查看今日快照是否已成功寫入
SELECT rank_type, COUNT(*) as count, MAX(snapshot_date) as date
FROM public.leaderboard_snapshots
GROUP BY rank_type
ORDER BY rank_type;
