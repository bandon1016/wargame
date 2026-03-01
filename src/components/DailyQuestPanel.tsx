import React, { useCallback, useEffect, useState } from 'react';
import { X, CheckCircle, Circle, Loader2 } from 'lucide-react';
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
    onClose: () => void;
    onReward: (gold: number, exp: number, currency?: { type: string; amount: number }) => void;
}

const CURRENCY_ICONS: Record<string, string> = {
    lingQi: '🌿',
    techFragments: '⚙️',
    incense: '🏮',
    saltCrystals: '🌊',
    premiumGems: '💎',
};

export const DailyQuestPanel: React.FC<DailyQuestPanelProps> = ({ userId, onClose, onReward }) => {
    const [quests, setQuests] = useState<QuestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [claiming, setClaiming] = useState<string | null>(null);

    const getQuestDef = (id: string): DailyQuest | undefined =>
        [...DAILY_QUEST_POOL, ...WEEKLY_QUEST_POOL].find(q => q.id === id);

    const fetchQuests = useCallback(async () => {
        setLoading(true);
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
            setError(e.message || '未知錯誤');
        } finally {
            setLoading(false);
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

    const daily = quests.filter(q => q.period === 'daily');
    const weekly = quests.filter(q => q.period === 'weekly');
    const completedCount = quests.filter(q => q.progress >= q.required && !q.claimed).length;

    return (
        <div className="bg-black/85 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-2xl w-72 pointer-events-auto anim-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="font-black text-white flex items-center gap-2">
                        📜 每日任務
                        {completedCount > 0 && (
                            <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                                {completedCount} 可領取
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-gray-500">{new Date().toLocaleDateString('zh-TW')}</div>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin text-game-accent" size={24} />
                </div>
            ) : error ? (
                <div className="text-center py-6">
                    <div className="text-red-400 text-xs mb-2">❌ 載入失敗</div>
                    <div className="text-[10px] text-gray-500 mb-3">{error}</div>
                    <button
                        onClick={fetchQuests}
                        className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full transition-colors"
                    >
                        重試
                    </button>
                </div>
            ) : quests.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-2xl mb-2">📦</div>
                    <div className="text-xs text-gray-500 font-bold">目前沒有可用的任務</div>
                    <div className="text-[9px] text-gray-600 mt-1">請確認已執行 SQL Migration</div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Daily Quests */}
                    <div className="space-y-2">
                        {daily.map(row => {
                            const def = getQuestDef(row.quest_id);
                            if (!def) return null;
                            const isDone = row.progress >= row.required;
                            return (
                                <QuestCard
                                    key={row.quest_id}
                                    def={def} row={row}
                                    isDone={isDone}
                                    isClaiming={claiming === row.quest_id}
                                    onClaim={() => handleClaim(row)}
                                />
                            );
                        })}
                    </div>

                    {/* Weekly Quest */}
                    {weekly.length > 0 && (
                        <div className="border-t border-white/10 pt-3">
                            <div className="text-[9px] font-black text-amber-400 uppercase tracking-wider mb-2">📅 每週任務</div>
                            <div className="space-y-2">
                                {weekly.map(row => {
                                    const def = getQuestDef(row.quest_id);
                                    if (!def) return null;
                                    const isDone = row.progress >= row.required;
                                    return (
                                        <QuestCard
                                            key={row.quest_id}
                                            def={def} row={row}
                                            isDone={isDone}
                                            isClaiming={claiming === row.quest_id}
                                            onClaim={() => handleClaim(row)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Sub-component ──────────────────────────────────────────────────
const QuestCard: React.FC<{
    def: DailyQuest;
    row: QuestRow;
    isDone: boolean;
    isClaiming: boolean;
    onClaim: () => void;
}> = ({ def, row, isDone, isClaiming, onClaim }) => {
    const pct = Math.min(100, Math.round((row.progress / row.required) * 100));
    return (
        <div className={`rounded-xl p-3 border transition-all ${row.claimed ? 'opacity-40 border-white/5 bg-white/2' : isDone ? 'border-emerald-500/50 bg-emerald-900/15' : 'border-white/10 bg-white/3'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {row.claimed ? <CheckCircle size={14} className="text-gray-600 flex-shrink-0" /> : isDone ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" /> : <Circle size={14} className="text-gray-600 flex-shrink-0" />}
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{def.title}</div>
                        <div className="text-[10px] text-gray-500 leading-tight">{def.description}</div>
                    </div>
                </div>
                {isDone && !row.claimed && (
                    <button
                        onClick={onClaim}
                        disabled={isClaiming}
                        className="flex-shrink-0 text-[10px] font-black bg-emerald-500 hover:bg-emerald-400 text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isClaiming ? '...' : '領取'}
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${row.claimed ? 'bg-gray-600' : isDone ? 'bg-emerald-500' : 'bg-game-accent'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500">{row.progress}/{row.required} {def.unit}</span>
                    <span className="text-[9px] text-gray-600">
                        +{def.reward.gold}💰 +{def.reward.exp}XP
                        {def.reward.currency && ` ${CURRENCY_ICONS[def.reward.currency.type]}×${def.reward.currency.amount}`}
                    </span>
                </div>
            </div>
        </div>
    );
};
