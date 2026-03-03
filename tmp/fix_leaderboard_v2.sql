-- ==========================================
-- 10. 排行榜快照刷新邏輯 (修正版 v2)
-- ==========================================
-- 修正：將 v_today 的類型由 text 修改為 date 以符合資料庫欄位類型

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_snapshots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today date := current_date;
    v_count integer;
BEGIN
    -- 1. 清除今日已存在的快照 (避免重複執行時產生多餘資料)
    DELETE FROM public.leaderboard_snapshots WHERE snapshot_date = v_today;

    -- 2. 插入等級榜 (Level Ranking)
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id,
        nickname,
        level,
        gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'level' as rank_type,
        row_number() OVER (ORDER BY level DESC, exp DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY level DESC, exp DESC
    LIMIT 100;

    -- 3. 插入財富榜 (Gold Ranking)
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id,
        nickname,
        level,
        gold,
        (attack * 5 + defense * 3 + max_hp * 0.5 + level * 100)::integer as power_score,
        'gold' as rank_type,
        row_number() OVER (ORDER BY gold DESC) as rank_position,
        v_today
    FROM public.profiles
    ORDER BY gold DESC
    LIMIT 100;

    -- 4. 插入戰力榜 (Power Ranking)
    INSERT INTO public.leaderboard_snapshots (
        user_id, nickname, level, gold, power_score, rank_type, rank_position, snapshot_date
    )
    SELECT 
        id as user_id,
        nickname,
        level,
        gold,
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
        'message', '排行榜快照已更新至 ' || v_today
    );
END;
$$;
