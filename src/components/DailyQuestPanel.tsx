import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Loader2, RefreshCw, Gift, Trophy, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DAILY_QUEST_POOL, WEEKLY_QUEST_POOL, CITY_QUEST_POOL } from '../types/game';
import type { DailyQuest } from '../types/game';

interface QuestRow {
    id: string; // Internal row ID
    quest_id: string;
    period: string;
    progress: number;
    required: number;
    claimed: boolean;
    assigned_date: string;
}

interface DailyQuestPanelProps {
    userId: string;
    onClose: () => void;
    onReward: (gold: number, exp: number, currency?: { type: string; amount: number }) => void;
    cityId?: string | null;
    onQuestsStatusUpdate?: (hasRewards: boolean) => void;
}

const CURRENCY_ICONS: Record<string, string> = {
    lingQi: '🌿',
    techFragments: '⚙️',
    incense: '🕯️',
    saltCrystals: '🌊',
    premiumGems: '💎',
};

export const DailyQuestPanel: React.FC<DailyQuestPanelProps> = ({ userId, onReward, cityId, onQuestsStatusUpdate }) => {
    const [quests, setQuests] = useState<QuestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [claiming, setClaiming] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCategory, setActiveCategory] = useState<'all' | 'daily' | 'weekly'>('all');

    const getQuestDef = (id: string): DailyQuest | undefined =>
        [...DAILY_QUEST_POOL, ...WEEKLY_QUEST_POOL, ...(CITY_QUEST_POOL || [])].find(q => q.id === id);

    const fetchQuests = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_or_reset_daily_quests', {
                p_user_id: userId,
                p_city_id: cityId
            });
            if (rpcError) {
                setError(rpcError.message);
            } else if (data) {
                const rows = data as QuestRow[];
                setQuests(rows);
                onQuestsStatusUpdate?.(rows.some(q => q.progress >= q.required && !q.claimed));
            } else {
                setQuests([]);
                onQuestsStatusUpdate?.(false);
            }
        } catch (e: any) {
            setError(e.message || '遠端伺服器回應錯誤');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, cityId, onQuestsStatusUpdate]);

    useEffect(() => { fetchQuests(); }, [fetchQuests]);

    const handleClaim = async (row: QuestRow) => {
        const def = getQuestDef(row.quest_id);
        if (!def) return;
        setClaiming(row.quest_id);
        const { error } = await supabase.rpc('claim_quest_reward', {
            p_user_id: userId,
            p_quest_id: row.quest_id,
            p_assigned_date: row.assigned_date,
        });
        if (!error) {
            onReward(def.reward.gold, def.reward.exp, def.reward.currency);
            const updated = quests.map(q =>
                q.quest_id === row.quest_id ? { ...q, claimed: true } : q
            );
            setQuests(updated);
            onQuestsStatusUpdate?.(updated.some(q => q.progress >= q.required && !q.claimed));
        }
        setClaiming(null);
    };

    const filteredQuests = quests
        .filter(q => activeCategory === 'all' || q.period === activeCategory)
        .sort((a, b) => {
            // Priority 1: Unclaimed completed quests at top
            const aDone = a.progress >= a.required && !a.claimed;
            const bDone = b.progress >= b.required && !b.claimed;
            if (aDone && !bDone) return -1;
            if (!aDone && bDone) return 1;

            // Priority 2: Claimed quests at bottom
            if (a.claimed && !b.claimed) return 1;
            if (!a.claimed && b.claimed) return -1;

            return 0;
        });

    const completedWaitClaim = quests.filter(q => q.progress >= q.required && !q.claimed).length;

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 px-4 py-6 md:px-8 max-w-4xl mx-auto">
            {/* COMPACT HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Trophy size={20} className="text-white fill-current" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white italic tracking-tight">冒險公會佈告欄</h2>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                            <span className="text-emerald-500">Active Quests</span>
                            <span>•</span>
                            <span>{completedWaitClaim} Rewards ready</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        <TabButton active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} label="全部" count={quests.length} />
                        <TabButton active={activeCategory === 'daily'} onClick={() => setActiveCategory('daily')} label="日常" count={quests.filter(q => q.period === 'daily').length} />
                        <TabButton active={activeCategory === 'weekly'} onClick={() => setActiveCategory('weekly')} label="週常" count={quests.filter(q => q.period === 'weekly').length} />
                    </div>
                    <button
                        onClick={() => fetchQuests(true)}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-30"
                        title="重整任務清單"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                        <Loader2 className="animate-spin text-amber-500" size={32} />
                        <div className="text-sm font-bold text-gray-400">調閱紀錄中...</div>
                    </div>
                ) : error ? (
                    <div className="text-center py-20 bg-red-500/5 border border-red-500/20 rounded-3xl p-8">
                        <p className="text-red-400 font-bold mb-4">{error}</p>
                        <button onClick={() => fetchQuests()} className="px-6 py-2 bg-white text-black font-black rounded-xl text-sm">重新整理</button>
                    </div>
                ) : filteredQuests.length === 0 ? (
                    <div className="text-center py-20 bg-white/2 border border-white/5 rounded-3xl opacity-40">
                        <div className="text-4xl mb-3">📭</div>
                        <p className="font-bold text-gray-500">暫無任務委託</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredQuests.map(row => {
                            const def = getQuestDef(row.quest_id);
                            if (!def) return null;
                            return (
                                <CompactQuestRow
                                    key={row.quest_id + row.assigned_date}
                                    def={def} row={row}
                                    isClaiming={claiming === row.quest_id}
                                    onClaim={() => handleClaim(row)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; count: number }> = ({ active, onClick, label, count }) => (
    <button
        onClick={onClick}
        className={`px-4 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-2 ${active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-400'}`}
    >
        {label}
        {count > 0 && <span className={`px-1.5 py-0.25 rounded-md text-[9px] ${active ? 'bg-amber-500/20 text-amber-400' : 'bg-black/20 text-gray-600'}`}>{count}</span>}
    </button>
);

const CompactQuestRow: React.FC<{
    def: DailyQuest;
    row: QuestRow;
    isClaiming: boolean;
    onClaim: () => void;
}> = ({ def, row, isClaiming, onClaim }) => {
    const isDone = row.progress >= row.required;
    const pct = Math.min(100, Math.round((row.progress / row.required) * 100));

    return (
        <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border transition-all ${row.claimed ? 'bg-black/20 border-white/5 opacity-50 grayscale' :
            isDone ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>

            {/* Left: Icon & Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${isDone && !row.claimed ? 'bg-emerald-500/20' : 'bg-white/5 border border-white/5'}`}>
                    {row.claimed ? <CheckCircle size={18} className="text-gray-500" /> : (row.period === 'daily' ? '📜' : '🛡️')}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${row.period === 'daily' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {row.period === 'daily' ? 'Daily' : 'Weekly'}
                        </span>
                        <h4 className="font-extrabold text-sm text-white truncate">{def.title}</h4>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{def.description}</p>
                </div>
            </div>

            {/* Middle: Rewards */}
            <div className="flex flex-wrap items-center gap-1.5 sm:px-4 sm:border-x border-white/5 max-w-[180px]">
                <RewardLabel icon="💰" amount={def.reward.gold} />
                <RewardLabel icon="✨" amount={def.reward.exp} />
                {def.reward.currency && <RewardLabel icon={CURRENCY_ICONS[def.reward.currency.type] || '💎'} amount={def.reward.currency.amount} />}
            </div>

            {/* Right: Progress & Action */}
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="flex-1 sm:w-32">
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-black ${isDone ? 'text-emerald-400' : 'text-gray-500'}`}>{row.progress}/{row.required} {def.unit}</span>
                        <span className="text-[10px] text-gray-600 font-bold">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                <div className="shrink-0 w-24">
                    {row.claimed ? (
                        <div className="text-[10px] font-black text-gray-600 text-center py-2 border border-white/5 rounded-lg bg-black/20">已領取</div>
                    ) : isDone ? (
                        <button
                            onClick={onClaim}
                            disabled={isClaiming}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-2 rounded-lg text-xs transition-all shadow-lg shadow-emerald-500/10 active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isClaiming ? <Loader2 className="animate-spin" size={12} /> : <Gift size={12} />}
                            領取
                        </button>
                    ) : (
                        <div className="text-[10px] font-black text-gray-700 text-center py-2 border border-dashed border-white/10 rounded-lg flex items-center justify-center gap-1">
                            <Target size={10} /> 未達成
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RewardLabel: React.FC<{ icon: string; amount: number }> = ({ icon, amount }) => (
    <div className="flex items-center gap-1.5 bg-black/20 border border-white/5 py-1 px-2 rounded-lg shadow-sm">
        <span className="text-xs">{icon}</span>
        <span className="text-[10px] sm:text-xs font-black text-white">{amount >= 1000 ? (amount / 1000).toFixed(1) + 'k' : amount}</span>
    </div>
);
