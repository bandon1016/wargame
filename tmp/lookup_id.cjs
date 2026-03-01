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

async function listLeaderboard() {
    const env = loadEnv();
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    console.log(`--- 正在查詢排行榜數據 ---`);
    const { data: rankings, error } = await supabase
        .from('leaderboard_snapshots')
        .select('user_id, nickname')
        .eq('nickname', '編董逛大街');

    if (error) {
        console.error('錯誤:', error);
        return;
    }

    if (rankings && rankings.length > 0) {
        console.log(`找到 ID: ${rankings[0].user_id} | 使用者: ${rankings[0].nickname}`);
    } else {
        console.log('在排行榜中找不到該使用者。');
    }
}

listLeaderboard();
