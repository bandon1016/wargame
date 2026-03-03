import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Star, Coins, Sword, TrendingUp, Info, Loader2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RankingEntry, CharacterStats } from '../types/game';

interface RankingTabProps {
    player: CharacterStats;
}

const RankingTab: React.FC<RankingTabProps> = ({ player }) => {
    const [rankings, setRankings] = useState<RankingEntry[]>([]);
    const [activeType, setActiveType] = useState<'level' | 'power' | 'gold'>('level');
    const [loading, setLoading] = useState(true);
    const [myRank, setMyRank] = useState<RankingEntry | null>(null);

    const fetchRankings = async (type: string) => {
        setLoading(true);
        try {
            // 1. 先獲取最新的快照日期
            const { data: dateData } = await supabase
                .from('leaderboard_snapshots')
                .select('snapshot_date')
                .order('snapshot_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            const latestDate = dateData?.snapshot_date;

            // 2. 獲取該次快照的前 50 名
            let rankingQuery = supabase
                .from('leaderboard_snapshots')
                .select('*')
                .eq('rank_type', type)
                .order('rank_position', { ascending: true })
                .limit(50);

            if (latestDate) {
                rankingQuery = rankingQuery.eq('snapshot_date', latestDate);
            }

            const { data, error } = await rankingQuery;
            if (error) throw error;
            setRankings(data || []);

            // 3. 嘗試獲取玩家自己在該次快照的排名
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
                let myRankQuery = supabase
                    .from('leaderboard_snapshots')
                    .select('*')
                    .eq('rank_type', type)
                    .eq('user_id', user.id);

                if (latestDate) {
                    myRankQuery = myRankQuery.eq('snapshot_date', latestDate);
                }

                const { data: myData, error: myError } = await myRankQuery.maybeSingle();
                if (!myError && myData) {
                    setMyRank(myData);
                } else {
                    setMyRank(null);
                }
            }
        } catch (err) {
            console.error('Error fetching rankings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRankings(activeType);
    }, [activeType]);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Medal className="text-yellow-400" size={24} />;
        if (rank === 2) return <Medal className="text-gray-300" size={24} />;
        if (rank === 3) return <Medal className="text-amber-600" size={24} />;
        return <span className="text-gray-500 font-mono text-sm">{rank}</span>;
    };


    return (
        <div className="flex flex-col h-full anim-fade-in relative">
            {/* Header */}
            <div className="px-6 pt-8 pb-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter flex items-center gap-3">
                            <Trophy className="text-game-gold animate-bounce" size={32} />
                            全服巔峰榜
                        </h2>
                        <p className="text-gray-400 text-xs font-bold mt-1 tracking-widest uppercase opacity-60">
                            Daily Snapshot • 每 24 小時更新一次
                        </p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex gap-2 p-1 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 mb-6">
                    {(['level', 'power', 'gold'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setActiveType(type)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${activeType === type
                                ? 'bg-game-accent text-game-dark shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            {type === 'level' && <TrendingUp size={16} />}
                            {type === 'power' && <Sword size={16} />}
                            {type === 'gold' && <Coins size={16} />}
                            {type === 'level' ? '等級' : type === 'power' ? '戰力' : '財富'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-32 custom-scrollbar">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="animate-spin text-game-accent" size={32} />
                        <p className="text-gray-500 font-bold animate-pulse">正在讀取巔峰數據...</p>
                    </div>
                ) : rankings.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-white/5 rounded-3xl">
                        <Star size={48} className="mb-4" />
                        <p className="font-bold">目前尚無排名數據</p>
                    </div>
                ) : (
                    <div className="bg-black/20 rounded-3xl border border-white/5 overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-white/5 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b border-white/10">
                                    <th className="px-4 py-4 text-center w-16">排名</th>
                                    <th className="px-4 py-4 text-left">英雄稱號</th>
                                    <th className="px-4 py-4 text-center hidden sm:table-cell">等級</th>
                                    <th className="px-4 py-4 text-right pr-6">數值</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {rankings.map((entry) => {
                                    const isMe = entry.user_id === myRank?.user_id;
                                    return (
                                        <tr
                                            key={entry.user_id}
                                            className={`group transition-all hover:bg-white/5 ${isMe ? 'bg-game-accent/5' : ''}`}
                                        >
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex justify-center">
                                                    {getRankIcon(entry.rank_position)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold truncate ${isMe ? 'text-game-accent text-lg' : 'text-gray-200'}`}>
                                                        {entry.nickname || '神秘勇者'}
                                                    </span>
                                                    {isMe && (
                                                        <span className="bg-game-accent text-game-dark text-[8px] px-1.5 py-0.5 rounded font-black shadow-[0_0_10px_rgba(56,189,248,0.3)]">ME</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-bold sm:hidden">
                                                    Lv.{entry.level} • {entry.power_score.toLocaleString()} 戰力
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center hidden sm:table-cell">
                                                <span className="font-mono text-gray-400 font-bold">Lv.{entry.level}</span>
                                            </td>
                                            <td className="px-4 py-4 text-right pr-6">
                                                <div className={`font-black italic tabular-nums ${isMe ? 'text-game-accent scale-110' : 'text-white'}`}>
                                                    {activeType === 'level' && <span>{entry.level} <span className="text-[10px] not-italic opacity-50 font-bold ml-1">LV</span></span>}
                                                    {activeType === 'power' && <span>{entry.power_score.toLocaleString()} <span className="text-[10px] not-italic opacity-50 font-bold ml-1">POW</span></span>}
                                                    {activeType === 'gold' && <span className="text-game-gold">{entry.gold.toLocaleString()} <span className="text-[10px] not-italic opacity-50 font-bold ml-1">💰</span></span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* My Rank Footer */}
            <div className="absolute bottom-4 left-6 right-6">
                <div className="glass-panel p-4 rounded-3xl border border-game-accent/30 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-game-accent/10 border border-game-accent/20 flex items-center justify-center text-game-accent">
                        <User size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs text-game-accent font-black uppercase tracking-wider mb-0.5">我的目前排名</div>
                        <div className="text-xl font-black text-white italic">
                            {myRank ? `NO.${myRank.rank_position}` : '未入榜'}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mb-1">結算數值</div>
                        <div className="text-sm font-black text-gray-300 tabular-nums">
                            {activeType === 'level' && `Lv.${player.level}`}
                            {activeType === 'power' && `${(player.attack * 5 + player.defense * 3 + player.maxHp * 0.5 + player.level * 100).toLocaleString()} 戰力`}
                            {activeType === 'gold' && `${player.gold.toLocaleString()} 💰`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Tip */}
            <div className="absolute bottom-[104px] left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 flex items-center gap-2 text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                    <Info size={12} /> 排行榜每日 00:00 結算，請努力提升實力！
                </div>
            </div>
        </div>
    );
};

export default RankingTab;
