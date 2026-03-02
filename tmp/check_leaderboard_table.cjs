const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function refreshAndCheck() {
    console.log('--- 正在嘗試執行 refresh_leaderboard_snapshots ---');
    const { data: rpcData, error: rpcError } = await supabase.rpc('refresh_leaderboard_snapshots');

    if (rpcError) {
        console.error('🚫 執行 RPC 失敗:', rpcError.message);
        console.log('請確保您已經在 Supabase SQL Editor 執行了最新的 SQL。');
    } else {
        console.log('✅ RPC 執行成功:', JSON.stringify(rpcData, null, 2));
    }

    console.log('\n--- 正在檢查最新的排行榜數據 ---');
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('leaderboard_snapshots')
        .select('*')
        .eq('snapshot_date', today)
        .order('rank_position', { ascending: true })
        .limit(5);

    if (error) {
        console.error('🚫 查詢失敗:', error.message);
    } else {
        console.log(`✅ 成功！找到今日 (${today}) 的數據:`, data.length, '筆');
        if (data.length > 0) {
            console.log('樣本數據 (Top 1):', JSON.stringify(data[0], null, 2));
        } else {
            console.log('⚠️ 資料表雖然存在，但今日數據為空。');
        }
    }
}

refreshAndCheck();
