-- ============================================================
-- Premium Shop Migration: active_buffs + Admin RPCs
-- ============================================================

-- 1. Add active_buffs JSONB column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_buffs JSONB DEFAULT '{}'::jsonb;

-- ============================================================
-- 2. RPC: secure_purchase_premium_item
--    玩家使用藍寶靈石購買加值道具並直接啟用 24 小時 Buff
-- ============================================================
CREATE OR REPLACE FUNCTION secure_purchase_premium_item(
    p_item_id TEXT,
    p_price INTEGER,
    p_buff_key TEXT,
    p_duration_ms BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_current_gems INTEGER;
    v_current_buffs JSONB;
    v_new_expiry BIGINT;
    v_now_ms BIGINT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '未登入';
    END IF;

    -- Lock the row
    SELECT premium_gems, COALESCE(active_buffs, '{}'::jsonb)
    INTO v_current_gems, v_current_buffs
    FROM profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_current_gems IS NULL THEN
        RAISE EXCEPTION '找不到玩家資料';
    END IF;

    IF v_current_gems < p_price THEN
        RAISE EXCEPTION '台灣藍寶靈石不足 (需要 % 顆，目前 % 顆)', p_price, v_current_gems;
    END IF;

    -- Calculate new expiry: max(current_expiry, now) + duration
    v_now_ms := EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
    v_new_expiry := GREATEST(
        COALESCE((v_current_buffs->>p_buff_key)::BIGINT, 0),
        v_now_ms
    ) + p_duration_ms;

    -- Update
    UPDATE profiles
    SET premium_gems = premium_gems - p_price,
        active_buffs = jsonb_set(
            COALESCE(active_buffs, '{}'::jsonb),
            ARRAY[p_buff_key],
            to_jsonb(v_new_expiry)
        ),
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'remaining_gems', v_current_gems - p_price,
        'buff_key', p_buff_key,
        'expiry', v_new_expiry
    );
END;
$$;

-- ============================================================
-- 3. RPC: secure_admin_grant_gems
--    管理員發放台灣藍寶靈石給指定使用者
-- ============================================================
CREATE OR REPLACE FUNCTION secure_admin_grant_gems(
    p_target_id UUID,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_target_gems INTEGER;
BEGIN
    -- Check admin identity
    SELECT email INTO v_admin_email
    FROM auth.users
    WHERE id = v_admin_id;

    IF v_admin_email IS NULL OR v_admin_email != 'werboy@gmail.com' THEN
        RAISE EXCEPTION '權限不足：僅限管理員使用';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION '數量必須為正整數';
    END IF;

    UPDATE profiles
    SET premium_gems = COALESCE(premium_gems, 0) + p_amount,
        updated_at = NOW()
    WHERE id = p_target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '找不到目標使用者';
    END IF;

    SELECT premium_gems INTO v_target_gems FROM profiles WHERE id = p_target_id;

    RETURN jsonb_build_object(
        'success', true,
        'target_id', p_target_id,
        'granted_amount', p_amount,
        'new_balance', v_target_gems
    );
END;
$$;

-- ============================================================
-- 4. RPC: secure_admin_grant_buff
--    管理員發放加值商城道具 (Buff) 給指定使用者
-- ============================================================
CREATE OR REPLACE FUNCTION secure_admin_grant_buff(
    p_target_id UUID,
    p_buff_key TEXT,
    p_duration_ms BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_current_buffs JSONB;
    v_new_expiry BIGINT;
    v_now_ms BIGINT;
BEGIN
    -- Check admin identity
    SELECT email INTO v_admin_email
    FROM auth.users
    WHERE id = v_admin_id;

    IF v_admin_email IS NULL OR v_admin_email != 'werboy@gmail.com' THEN
        RAISE EXCEPTION '權限不足：僅限管理員使用';
    END IF;

    SELECT COALESCE(active_buffs, '{}'::jsonb)
    INTO v_current_buffs
    FROM profiles
    WHERE id = p_target_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '找不到目標使用者';
    END IF;

    v_now_ms := EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
    v_new_expiry := GREATEST(
        COALESCE((v_current_buffs->>p_buff_key)::BIGINT, 0),
        v_now_ms
    ) + p_duration_ms;

    UPDATE profiles
    SET active_buffs = jsonb_set(
            COALESCE(active_buffs, '{}'::jsonb),
            ARRAY[p_buff_key],
            to_jsonb(v_new_expiry)
        ),
        updated_at = NOW()
    WHERE id = p_target_id;

    RETURN jsonb_build_object(
        'success', true,
        'target_id', p_target_id,
        'buff_key', p_buff_key,
        'expiry', v_new_expiry
    );
END;
$$;

-- ============================================================
-- 5. RPC: secure_admin_resolve_uid
--    管理員透過玩家 UID (G-xxxx) 查詢真實 UUID
--    使用 SECURITY DEFINER 繞過 RLS
-- ============================================================
CREATE OR REPLACE FUNCTION secure_admin_resolve_uid(
    p_uid TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_target_id UUID;
    v_clean_uid TEXT := UPPER(TRIM(p_uid));
BEGIN
    -- Check admin identity
    SELECT email INTO v_admin_email
    FROM auth.users
    WHERE id = v_admin_id;

    IF v_admin_email IS NULL OR v_admin_email != 'werboy@gmail.com' THEN
        RAISE EXCEPTION '權限不足：僅限管理員使用';
    END IF;

    -- Search in profiles. Since SECURITY DEFINER is used, this bypasses RLS.
    -- We assume 'uid' or 'uid_12_code' exists in profiles.
    SELECT id INTO v_target_id
    FROM profiles
    WHERE 
        (UPPER(uid) = v_clean_uid) OR 
        (UPPER(uid_12_code) = v_clean_uid)
    LIMIT 1;

    IF v_target_id IS NULL THEN
        RAISE EXCEPTION '找不到目標玩家 UID: %', p_uid;
    END IF;

    RETURN v_target_id;
END;
$$;
