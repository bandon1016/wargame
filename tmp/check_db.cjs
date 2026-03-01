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
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ 錯誤：找不到 Supabase 設定。請確保 .env.local 存在且正確。');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRankings() {
    console.log('--- 正在檢查排行榜與角色資料一致性 ---');

    try {
        // 1. 取得財富榜 (gold) 前 10 名
        const { data: rankings, error: rankError } = await supabase
            .from('leaderboard_snapshots')
            .select('*')
            .eq('rank_type', 'gold')
            .order('rank_position', { ascending: true })
            .limit(10);

        if (rankError) {
            console.error('取得排行榜失敗:', rankError);
            return;
        }

        if (!rankings || rankings.length === 0) {
            console.log('目前排行榜沒有數據。');
            return;
        }

        console.log(`找到 ${rankings.length} 筆排行榜數據`);

        // 2. 針對排行榜上的使用者，去 profiles 表檢查實際金幣
        const userIds = rankings.map(r => r.user_id);
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, gold, nickname')
            .in('id', userIds);

        if (profileError) {
            console.error('取得角色資料失敗:', profileError);
            return;
        }

        console.log('\n--- 數據對比 ---');
        console.log('排名 | 使用者 | 快照金幣 | 實際金幣 | 狀態');
        console.log('-----|--------|----------|----------|-----');

        rankings.forEach(rank => {
            const profile = profiles.find(p => p.id === rank.user_id);
            const rankGold = rank.gold;
            const realGold = profile ? profile.gold : 'N/A';
            const nickname = rank.nickname || 'Unknown';

            let status = '⚠️ RLS 受限 (無法查看他人資料)';
            if (profile) {
                const diff = Math.abs(rankGold - realGold);
                if (diff < 0.1) status = '✅ 完全一致';
                else if (realGold > rankGold) status = '📈 實時較高 (領先結算)';
                else status = '📉 實時較低 (有消耗)';
            }

            console.log(`${rank.rank_position.toString().padEnd(4)} | ${nickname.padEnd(8)} | ${Math.floor(rankGold).toString().padStart(8)} | ${profile ? Math.floor(realGold).toString().padStart(8) : 'N/A'.padStart(8)} | ${status}`);
        });

        console.log('\n💡 提示：');
        console.log('1. 目前使用 Anon Key 執行，由於資料庫 RLS (Row Level Security) 限制，您只能查看「自己的」或「公開權限」下可讀取的資料。');
        console.log('2. 排行榜為快照機制，若玩家在結算後有金幣增減，兩邊數值不相同是正常的。');
    } catch (e) {
        console.error('執行過程中發生異常:', e);
    }
}

checkRankings();
