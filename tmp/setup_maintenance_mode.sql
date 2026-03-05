-- 1. 建立設定檔資料表
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 開放讀取權限
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_settings;
CREATE POLICY "Enable read access for all users" ON public.app_settings FOR SELECT USING (true);

-- 3. 安全更新 RPC (僅限管理員寫入)
CREATE OR REPLACE FUNCTION public.secure_admin_set_setting(p_key text, p_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_email text;
BEGIN
    SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
    IF v_admin_email IS NULL OR v_admin_email != 'werboy@gmail.com' THEN
        RAISE EXCEPTION '操作被拒絕：權限不足。';
    END IF;
    
    INSERT INTO public.app_settings (key, value, updated_at) 
    VALUES (p_key, p_value, now())
    ON CONFLICT (key) DO UPDATE SET value = p_value, updated_at = now();
    
    RETURN true;
END;
$$;

-- 4. 初始化維護模式關閉狀態
INSERT INTO public.app_settings (key, value) VALUES ('maintenance_mode', 'false') ON CONFLICT DO NOTHING;

-- 5. 啟用 Supabase Realtime 廣播 (如果尚未加入)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
    END IF;
END
$$;
