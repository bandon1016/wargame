import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Circle, Loader2, RefreshCw, Star, Calendar, Zap, Gift, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DAILY_QUEST_POOL, WEEKLY_QUEST_POOL } from '../types/game';
import type { DailyQuest } from '../types/game';

interface QuestRow {
    quest_id: string;
    period: string;
    progress: number;
    required: number;
    claimed: boolean;
    assigned_date: string;
}

interface DailyQuestPanelProps {
    userId: string;
    onClose: () => void; // 保留 prop 接口以防萬一
    onReward: (gold: number, exp: number, currency?: { type: string; amount: number }) => void;
}

const CURRENCY_ICONS: Record<string, string> = {
    lingQi: '🌿',
    techFragments: '⚙️',
    incense: '🏮',
    saltCrystals: '🌊',
    premiumGems: '💎',
};

const CATEGORY_ICONS: Record<string, string> = {
    daily: '🌅',
    weekly: '📅',
};

export const DailyQuestPanel: React.FC<DailyQuestPanelProps> = ({ userId, onReward }) => {
    const [quests, setQuests] = useState<QuestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [claiming, setClaiming] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCategory, setActiveCategory] = useState<'all' | 'daily' | 'weekly'>('all');

    const getQuestDef = (id: string): DailyQuest | undefined =>
        [...DAILY_QUEST_POOL, ...WEEKLY_QUEST_POOL].find(q => q.id === id);

    const fetchQuests = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_or_reset_daily_quests', { p_user_id: userId });
            if (rpcError) {
                setError(rpcError.message);
            } else if (data) {
                setQuests(data as QuestRow[]);
            } else {
                setQuests([]);
            }
        } catch (e: any) {
            setError(e.message || '遠端伺服器回應錯誤');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

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
            setQuests(prev => prev.map(q =>
                q.quest_id === row.quest_id ? { ...q, claimed: true } : q
            ));
        }
        setClaiming(null);
    };

    const filteredQuests = quests.filter(q => activeCategory === 'all' || q.period === activeCategory);
    const daily = quests.filter(q => q.period === 'daily');
    const weekly = quests.filter(q => q.period === 'weekly');
    const completedWaitClaim = quests.filter(q => q.progress >= q.required && !q.claimed).length;
    const today = new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 pb-12 px-4 md:px-0">
            {/* 頂部英雄區塊 - 重點顯示統計 */}
            <div className="glass-panel relative overflow-hidden rounded-[3rem] border border-white/10 p-10 bg-gradient-to-br from-slate-900 to-black shadow-2xl">
                {/* 裝飾性光效 */}
                <div className="absolute -right-32 -top-32 w-96 h-96 bg-game-accent/15 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -left-32 -bottom-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                    <div>
                        <div className="flex items-center gap-5 mb-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/20">
                                <Star size={32} className="text-white fill-current" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-white italic tracking-tighter">冒險公會佈告欄</h1>
                                <p className="text-base text-gray-500 font-medium tracking-widest mt-1 uppercase">Adventure Association Registry</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-lg font-bold">
                            <Calendar size={20} className="text-game-accent" />
                            <span className="text-white">{today}</span>
                            <span className="text-gray-600">|</span>
                            <span className="text-emerald-400">當前任務活躍中</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:min-w-[500px]">
                        <StatCard label="每日達成" current={daily.filter(q => q.claimed).length} total={daily.length} icon={<Zap size={18} className="text-blue-400" />} />
                        <StatCard label="本週突破" current={weekly.filter(q => q.claimed).length} total={weekly.length} icon={<Star size={18} className="text-amber-400" />} />
                        <div className="col-span-2 sm:col-span-1 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl p-5 flex flex-col items-center justify-center group hover:bg-emerald-500/25 transition-all">
                            <div className="text-3xl font-black text-emerald-400 group-hover:scale-110 transition-transform">{completedWaitClaim}</div>
                            <div className="text-xs text-emerald-500/70 font-black mt-1 uppercase">待領賞金</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 控制區 */}
            <div className="flex flex-wrap items-center justify-between gap-5 px-2">
                <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10">
                    <TabButton active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} label="全體任務" count={quests.length} />
                    <TabButton active={activeCategory === 'daily'} onClick={() => setActiveCategory('daily')} label="每日目標" count={daily.length} />
                    <TabButton active={activeCategory === 'weekly'} onClick={() => setActiveCategory('weekly')} label="每週挑戰" count={weekly.length} />
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => fetchQuests(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all disabled:opacity-30 active:scale-95"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        <span>更新情報</span>
                    </button>
                </div>
            </div>

            {/* 任務列表噴發區 */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-5">
                    <Loader2 className="animate-spin text-game-accent" size={48} />
                    <div className="text-xl font-bold text-gray-500 tracking-widest animate-pulse">正在調閱公會紀錄...</div>
                </div>
            ) : error ? (
                <div className="glass-panel rounded-[2.5rem] p-12 text-center border border-red-500/20 max-w-2xl mx-auto">
                    <div className="text-5xl mb-6">🏜️</div>
                    <h3 className="text-2xl font-black text-white mb-2">無法連接到冒險公會</h3>
                    <p className="text-gray-500 mb-8 leading-relaxed text-lg">{error}</p>
                    <button onClick={() => fetchQuests()} className="bg-white text-black font-black px-10 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all text-lg shadow-xl shadow-white/10">
                        點擊重新嘗試
                    </button>
                </div>
            ) : filteredQuests.length === 0 ? (
                <div className="glass-panel rounded-[2.5rem] p-24 text-center border border-white/10 bg-white/2">
                    <div className="text-7xl mb-6 opacity-30">📭</div>
                    <h3 className="text-2xl font-black text-white/50">目前佈告欄空空如也</h3>
                    <p className="text-gray-600 mt-2 text-lg">完成當前任務後，新的委託將會在此出現</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredQuests.map(row => {
                        const def = getQuestDef(row.quest_id);
                        if (!def) return null;
                        return (
                            <QuestCard
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
    );
};

// ── 子組件：統計卡 ──────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; current: number; total: number; icon: React.ReactNode }> = ({ label, current, total, icon }) => (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-5 hover:bg-white/10 transition-all">
        <div className="flex items-center gap-2 mb-2 text-gray-500 uppercase font-black text-[10px] tracking-widest">
            {icon} {label}
        </div>
        <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">{current}</span>
            <span className="text-gray-600 font-bold text-lg">/ {total}</span>
        </div>
    </div>
);

// ── 子組件：切換按鈕 ────────────────────────────────────────────────
const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; count: number }> = ({ active, onClick, label, count }) => (
    <button
        onClick={onClick}
        className={`relative px-8 py-3.5 rounded-xl font-black text-base transition-all flex items-center gap-3 ${active ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
    >
        {label}
        <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-game-accent text-white' : 'bg-white/5 text-gray-600'}`}>
            {count}
        </span>
        {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-game-accent rounded-full shadow-[0_0_10px_#f59e0b]" />}
    </button>
);

// ── 子組件：大器任務卡片 ──────────────────────────────────────────────
const QuestCard: React.FC<{
    def: DailyQuest;
    row: QuestRow;
    isClaiming: boolean;
    onClaim: () => void;
}> = ({ def, row, isClaiming, onClaim }) => {
    const isDone = row.progress >= row.required;
    const pct = Math.min(100, Math.round((row.progress / row.required) * 100));

    return (
        <div className={`group glass-panel relative rounded-[2rem] border transition-all duration-300 overflow-hidden flex flex-col h-full ${row.claimed ? 'opacity-40 border-white/5 grayscale-[0.8]' :
                isDone ? 'border-emerald-500/50 bg-emerald-500/5 shadow-2xl shadow-emerald-500/5' : 'border-white/10 hover:border-white/30 bg-white/2 hover:transform hover:-translate-y-1'
            }`}>
            {/* 上半部：標題與詳情 */}
            <div className="p-7 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${row.period === 'daily' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {row.period === 'daily' ? '每日任務' : '精銳挑戰'}
                    </div>
                    {isDone && !row.claimed && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shadow-[0_0_10px_#10b981]" />}
                </div>

                <div className="flex gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-lg ${isDone ? 'bg-emerald-500/20 shadow-emerald-500/10' : 'bg-white/5 border border-white/5'}`}>
                        {row.claimed ? '📁' : (row.period === 'daily' ? '📜' : '⚔️')}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xl font-extrabold text-white leading-tight mb-1 group-hover:text-game-accent transition-colors">
                            {def.title}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium leading-relaxed">
                            {def.description}
                        </p>
                    </div>
                </div>

                {/* 獎勵展示區 */}
                <div className="mt-8">
                    <div className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3">委託達成賞金</div>
                    <div className="flex flex-wrap gap-3">
                        <RewardBadge icon="💰" amount={def.reward.gold} label="金幣" />
                        <RewardBadge icon="✨" amount={def.reward.exp} label="經驗" />
                        {def.reward.currency && <RewardBadge icon={CURRENCY_ICONS[def.reward.currency.type] || '💎'} amount={def.reward.currency.amount} label="稀有資源" />}
                    </div>
                </div>
            </div>

            {/* 下半部：進度與操作 */}
            <div className={`p-7 pt-0 mt-auto ${isDone && !row.claimed ? 'bg-emerald-500/10' : ''}`}>
                <div className="flex justify-between items-end mb-3">
                    <div className="font-black">
                        <span className={`text-2xl ${isDone ? 'text-emerald-400' : 'text-white'}`}>{row.progress}</span>
                        <span className="text-gray-600 text-lg"> / {row.required}</span>
                        <span className="text-gray-500 text-sm ml-1.5 font-bold">{def.unit}</span>
                    </div>
                    <div className="text-sm font-bold text-gray-500">{pct}%</div>
                </div>

                {/* 進度條 */}
                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 mb-6">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-lg ${row.claimed ? 'bg-slate-700' :
                                isDone ? 'bg-gradient-to-r from-emerald-600 to-teal-400 shadow-emerald-500/20' :
                                    'bg-gradient-to-r from-game-accent to-orange-500 shadow-orange-500/10'
                            }`}
                        style={{ width: `${pct}%` }}
                    >
                        {pct > 5 && <div className="w-full h-full bg-white/10 animate-shimmer" />}
                    </div>
                </div>

                {isDone && !row.claimed ? (
                    <button
                        onClick={onClaim}
                        disabled={isClaiming}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3 text-lg group/btn"
                    >
                        {isClaiming ? <Loader2 className="animate-spin" size={20} /> : <Gift size={20} className="group-hover/btn:rotate-12 transition-transform" />}
                        {isClaiming ? '正在請領中...' : '發放獎勵回報'}
                    </button>
                ) : row.claimed ? (
                    <div className="w-full py-4 text-center text-gray-500 font-bold border border-white/5 rounded-2xl bg-white/2 flex items-center justify-center gap-2">
                        <CheckCircle size={18} /> 已領取委託獎勵
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs font-black px-1">
                        <div className="flex items-center gap-2 text-gray-500 italic">
                            目標達成後即可回報
                        </div>
                        <ChevronRight className="text-gray-700" size={16} />
                    </div>
                )}
            </div>
        </div>
    );
};

const RewardBadge: React.FC<{ icon: string; amount: number; label: string }> = ({ icon, amount, label }) => (
    <div className="flex flex-col bg-white/5 border border-white/5 rounded-2xl px-4 py-2 hover:bg-white/10 transition-colors">
        <div className="text-[9px] font-black text-gray-600 uppercase mb-0.5 tracking-tighter">{label}</div>
        <div className="flex items-center gap-1.5 font-black text-white text-base">
            <span className="text-base">{icon}</span>
            <span>{amount.toLocaleString()}</span>
        </div>
    </div>
);
