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
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
    return env;
}

async function updateIncense() {
    const env = loadEnv();
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    const targetNickname = '編董逛大街';
    const amountToAdd = 50000;

    console.log(`--- 正在搜尋玩家: ${targetNickname} ---`);

    // 1. 根據暱稱找尋使用者
    const { data: profiles, error: findError } = await supabase
        .from('profiles')
        .select('id, incense, nickname')
        .eq('nickname', targetNickname);

    if (findError) {
        console.error('搜尋玩家時發生錯誤:', findError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.error(`找不到暱稱為 "${targetNickname}" 的玩家。`);
        return;
    }

    const targetUser = profiles[0];
    const newIncense = (targetUser.incense || 0) + amountToAdd;

    console.log(`找到玩家: ${targetUser.nickname} (ID: ${targetUser.id})`);
    console.log(`目前香火: ${targetUser.incense || 0} -> 將更新為: ${newIncense}`);

    // 2. 更新香火
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ incense: newIncense })
        .eq('id', targetUser.id);

    if (updateError) {
        console.error('更新香火時發生錯誤:', updateError);
        console.log('💡 注意：如果收到 RLS 錯誤，代表目前的 Anon Key 權限不足以修改他人資料。');
    } else {
        console.log(`✅ 成功發送 50,000 點香火！`);
    }
}

updateIncense();
