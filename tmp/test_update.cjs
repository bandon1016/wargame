const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('找不到 .env.local 檔案');
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').filter(l => l.includes('=')).forEach(line => {
        const parts = line.split('=');
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key && value) env[key] = value;
    });
    return env;
}

async function tryUpdateById() {
    const env = loadEnv();
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    const targetId = 'fb328aa0-3d35-4d4a-bae4-7a85d7fad0ec'; // ID from leaderboard
    const amountToAdd = 50000;

    console.log(`--- 正在直接嘗試更新 ID: ${targetId} 的香火 ---`);

    // First try to select to see if it's visible
    const { data: visible, error: seeError } = await supabase
        .from('profiles')
        .select('nickname, incense')
        .eq('id', targetId);

    if (seeError) {
        console.error('查看失敗:', seeError);
    } else if (!visible || visible.length === 0) {
        console.warn('⚠️ 無法查看到該 ID 的資料，這代表 RLS (Row Level Security) 可能正在運作。');
    } else {
        console.log(`已看到資料: ${visible[0].nickname}, 目前香火: ${visible[0].incense}`);

        const { error: updError } = await supabase
            .from('profiles')
            .update({ incense: (visible[0].incense || 0) + amountToAdd })
            .eq('id', targetId);

        if (updError) {
            console.error('更新過程發生錯誤:', updError);
        } else {
            console.log('✅ 更新指令已送出，請檢查是否生效。');
            return;
        }
    }

    console.log('\n❌ 由於 RLS 限制，我無法從外部修改此 ID。');
    console.log('請在 Supabase Dashboard 執行 SQL 指令：');
    console.log(`UPDATE profiles SET incense = COALESCE(incense, 0) + 50000 WHERE id = '${targetId}';`);
}

tryUpdateById();
