const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
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

async function checkUIDs() {
    const env = loadEnv();
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    // List one row to see all keys
    const { data: firstRows, error: colError } = await supabase.from('profiles').select('*').limit(1);

    if (colError) {
        console.error('Error fetching profiles:', colError);
        return;
    }

    if (firstRows.length === 0) {
        console.log('No profiles found.');
        return;
    }

    console.log('--- Columns available in profiles ---');
    console.log(Object.keys(firstRows[0]));

    console.log('\n--- Sample UID data ---');
    const { data, error } = await supabase.from('profiles').select('id, uid, uid_12_code, nickname').limit(3);
    if (error) {
        console.error('Error fetching UID samples:', error);
    } else {
        data.forEach(p => {
            console.log(`ID: ${p.id} | UID: ${p.uid} | UID_12: ${p.uid_12_code} | Nickname: ${p.nickname}`);
        });
    }
}

checkUIDs();
