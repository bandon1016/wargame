const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 手動解析 .env.local
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length) {
            env[key.trim()] = value.join('=').trim();
        }
    });
    return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 錯誤：找不到 Supabase 設定。');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findUser() {
    const targetUid = '980556200140';
    console.log(`--- 正在搜尋 UID: ${targetUid} ---`);

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, nickname, uid, incense')
            .eq('uid', targetUid);

        if (error) {
            console.error('❌ 查詢失敗:', error.message);
            return;
        }

        if (data.length === 0) {
            console.log('❌ 找不到該 UID 的玩家。正在嘗試模糊搜尋或列出所有 UID...');
            const { data: allUsers } = await supabase.from('profiles').select('uid, nickname').limit(10);
            console.log('前 10 筆 UID 範例:');
            console.table(allUsers);
        } else {
            console.log(`✅ 找到玩家! 發放中...`);
            const profile = data[0];
            const newIncense = (profile.incense || 0) + 50000;
            const { data: updated, error: uError } = await supabase.from('profiles').update({ incense: newIncense }).eq('id', profile.id).select();
            if (uError) console.error('更新失敗:', uError.message);
            else console.log(`✅ 成功! 新香火: ${updated[0].incense}`);
        }
    } catch (e) {
        console.error('執行異常:', e);
    }
}

findUser();
