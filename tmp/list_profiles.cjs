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

async function listProfiles() {
    const env = loadEnv();
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    console.log(`--- 正在列出前 5 筆玩家 ---`);
    const { data, error } = await supabase.from('profiles').select('id, nickname, incense').limit(5);

    if (error) {
        console.error('錯誤:', error);
        return;
    }

    data.forEach(p => {
        console.log(`ID: ${p.id} | Nickname: [${p.nickname}] | 香火: ${p.incense}`);
    });
}

listProfiles();
