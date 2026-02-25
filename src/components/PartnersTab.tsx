import React, { useState, useMemo } from 'react';
import { Star, Sparkles, UserPlus, Users, ShieldAlert, CheckCircle2, MinusCircle, PlusCircle, Loader2 } from 'lucide-react';
import type { Partner, CharacterStats } from '../types/game';
import { RARITY_COLORS } from '../types/game';

interface Props {
    player: CharacterStats;
    onUpdatePlayer: (a: React.SetStateAction<CharacterStats>) => void;
    saveProfile: (p: CharacterStats) => void;
    isCombatAction: boolean;
}

const pool = [
    { name: '聖靈騎士', role: 'tank' as const, rarity: 5 as const, power: 50, avatar: '🧔' },
    { name: '精靈射手', role: 'dps' as const, rarity: 4 as const, power: 35, avatar: '🧝' },
    { name: '治癒修女', role: 'healer' as const, rarity: 4 as const, power: 25, avatar: '👩‍🦰' },
    { name: '鐵甲守衛', role: 'tank' as const, rarity: 3 as const, power: 15, avatar: '👨‍🦲' },
    { name: '見習法師', role: 'dps' as const, rarity: 3 as const, power: 20, avatar: '🧙' },
    { name: '流浪劍客', role: 'dps' as const, rarity: 3 as const, power: 18, avatar: '👨‍🦱' },
    { name: '暗影刺客', role: 'dps' as const, rarity: 5 as const, power: 55, avatar: '🕵️' },
    { name: '大地祭司', role: 'healer' as const, rarity: 4 as const, power: 30, avatar: '👳' },
];

const getLatestAvatar = (name: string, fallback: string) => {
    return pool.find(p => p.name === name)?.avatar || fallback;
};

const RoleTag = ({ role }: { role: string }) => {
    const m: Record<string, { color: string; label: string }> = {
        tank: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', label: '坦克' },
        dps: { color: 'bg-red-500/20 text-red-400 border-red-500/40', label: '輸出' },
        healer: { color: 'bg-green-500/20 text-green-400 border-green-500/40', label: '治療' },
    };
    const c = m[role] ?? m.dps;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.color}`}>{c.label}</span>;
};

const Stars = ({ n }: { n: number }) => (
    <div className="flex">{Array.from({ length: n }).map((_, i) => <Star key={i} size={10} fill="#fbbf24" className="text-game-gold" />)}</div>
);

export const PartnersTab: React.FC<Props> = ({ player, onUpdatePlayer, saveProfile, isCombatAction }) => {
    const [anim, setAnim] = useState(false);
    const [drawn, setDrawn] = useState<Partner | null>(null);

    const gacha = () => {
        if (player.gold < 100) { alert('金幣不足！需要 100 金幣'); return; }
        setAnim(true); setDrawn(null);

        setTimeout(() => {
            const r = Math.random();
            let rarity: 3 | 4 | 5 = 3;
            if (r > 0.99) rarity = 5; else if (r > 0.89) rarity = 4;
            const cands = pool.filter(p => p.rarity === rarity);
            const s = cands[Math.floor(Math.random() * cands.length)];
            const np: Partner = { id: Math.random().toString(), ...s, level: 1, isDeployed: false };

            setDrawn(np);
            setAnim(false);

            onUpdatePlayer(prev => {
                const nextState = {
                    ...prev,
                    gold: prev.gold - 100,
                    partners: [...prev.partners, np]
                };
                saveProfile(nextState); // SYNC FIX: Persist latest state
                return nextState;
            });
        }, 1500);
    };

    const toggleDeploy = (partnerId: string) => {
        if (isCombatAction) {
            alert('戰鬥中無法變更陣容配置！');
            return;
        }

        onUpdatePlayer(prev => {
            const isCurrentlyDeployed = prev.partners.find(p => p.id === partnerId)?.isDeployed;
            const deployedCount = prev.partners.filter(p => p.isDeployed).length;

            if (!isCurrentlyDeployed && deployedCount >= 5) {
                alert('最多隻能派遣 5 位夥伴上陣！');
                return prev;
            }

            const nextPartners = prev.partners.map(p =>
                p.id === partnerId ? { ...p, isDeployed: !p.isDeployed } : p
            );
            const nextState = { ...prev, partners: nextPartners };
            saveProfile(nextState);
            return nextState;
        });
    };

    // Grouping logic for "stacked" display
    const groupedPartners = useMemo(() => {
        const groups: Record<string, { base: any, count: number, deployedIds: string[], undeployedIds: string[] }> = {};
        player.partners.forEach(p => {
            const latestAvatar = getLatestAvatar(p.name, p.avatar);
            if (!groups[p.name]) {
                groups[p.name] = { base: { ...p, avatar: latestAvatar }, count: 0, deployedIds: [], undeployedIds: [] };
            }
            groups[p.name].count++;
            if (p.isDeployed) groups[p.name].deployedIds.push(p.id);
            else groups[p.name].undeployedIds.push(p.id);
        });
        return Object.values(groups).sort((a, b) => b.base.rarity - a.base.rarity);
    }, [player.partners]);

    const currentDeployed = player.partners.filter(p => p.isDeployed);

    return (
        <div className="flex h-full w-full overflow-hidden bg-black/40">
            {/* LEFT: Gacha Sidebar */}
            <div className="w-1/3 min-w-[300px] border-r border-white/10 p-6 flex flex-col gap-6 overflow-y-auto">
                <div className="glass-panel rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden border-2 border-amber-500/30 shadow-2xl bg-gradient-to-b from-amber-500/10 to-transparent">
                    <div className="absolute inset-0 anim-shimmer pointer-events-none opacity-30" />
                    <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mb-4 border-2 border-amber-500/40">
                        <Sparkles size={40} className="text-game-gold anim-float" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2 italic">魂之招募</h3>
                    <p className="text-xs text-gray-400 mb-6 leading-relaxed">尋找跨越時空的契約者<br />為勇者提供命運加護</p>

                    <button
                        onClick={gacha}
                        disabled={anim}
                        className="group w-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black py-4 px-6 rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_4px_20px_rgba(251,191,36,0.4)] flex flex-col items-center gap-0.5"
                    >
                        {anim ? (
                            <><Loader2 className="animate-spin" /> <span className="text-sm">共鳴中...</span></>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <UserPlus size={18} />
                                    <span>起始召喚</span>
                                </div>
                                <div className="text-[10px] opacity-70">消耗 100 金幣</div>
                            </>
                        )}
                    </button>

                    {drawn && !anim && (
                        <div className={`mt-8 p-5 rounded-3xl border-2 w-full animate-in zoom-in-95 duration-300 relative ${RARITY_COLORS[drawn.rarity].border} ${RARITY_COLORS[drawn.rarity].bg} ${RARITY_COLORS[drawn.rarity].glow}`}>
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black px-3 py-1 rounded-full border border-white/20 text-[10px] font-bold text-game-gold whitespace-nowrap">NEW PARTNER</div>
                            <div className="text-5xl mb-3 transform group-hover:scale-110 transition-transform">{drawn.avatar}</div>
                            <div className="flex justify-center mb-2"><Stars n={drawn.rarity} /></div>
                            <div className="font-black text-lg text-white mb-1">{drawn.name}</div>
                            <div className="flex flex-col items-center gap-2">
                                <RoleTag role={drawn.role} />
                                <div className="text-[11px] font-mono text-gray-300 bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">戰鬥力: {drawn.power}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-white/5 mt-auto">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ShieldAlert size={14} className="text-amber-500" /> 招募法則
                    </h4>
                    <ul className="text-[11px] text-gray-500 space-y-2 font-medium">
                        <li className="flex justify-between"><span>五星傳奇夥伴</span> <span className="text-game-gold font-bold">1%</span></li>
                        <li className="flex justify-between"><span>四星史詩夥伴</span> <span className="text-gray-300 font-bold">10%</span></li>
                        <li className="flex justify-between"><span>三星精英夥伴</span> <span className="text-gray-500 font-bold">89%</span></li>
                    </ul>
                </div>
            </div>

            {/* RIGHT: Roster Management */}
            <div className="flex-1 p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                {/* Current Formation */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <Users size={24} className="text-game-accent" />
                            出陣陣容 <span className="text-sm font-bold text-game-accent bg-game-accent/10 px-3 py-1 rounded-full border border-game-accent/20">{currentDeployed.length} / 5</span>
                        </h2>
                        {isCombatAction && (
                            <div className="text-[11px] text-red-400 font-black flex items-center gap-1.5 animate-pulse bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">
                                <ShieldAlert size={12} /> 戰鬥進行中，陣容已鎖定
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-5 gap-4">
                        {[0, 1, 2, 3, 4].map(idx => {
                            const p = currentDeployed[idx];
                            return (
                                <div key={idx} className={`aspect-[3/4] rounded-3xl border-2 flex flex-col items-center justify-center p-4 transition-all relative group ${p ? `${RARITY_COLORS[p.rarity].border} ${RARITY_COLORS[p.rarity].bg} ${RARITY_COLORS[p.rarity].glow}` : 'border-dashed border-white/10 bg-black/20 text-gray-700'}`}>
                                    {p ? (
                                        <>
                                            <button
                                                disabled={isCombatAction}
                                                onClick={() => toggleDeploy(p.id)}
                                                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform hover:bg-red-400 disabled:hidden"
                                            >
                                                <MinusCircle size={18} />
                                            </button>
                                            <div className="text-4xl mb-3">{getLatestAvatar(p.name, p.avatar)}</div>
                                            <div className="text-[10px] font-black text-white/50 mb-1 uppercase tracking-tighter">LV.{p.level}</div>
                                            <div className="font-black text-sm truncate w-full text-center px-1 mb-1">{p.name}</div>
                                            <Stars n={p.rarity} />
                                            <div className="mt-2"><RoleTag role={p.role} /></div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                            <div className="w-12 h-12 rounded-2xl border-2 border-current flex items-center justify-center">?</div>
                                            <div className="text-[10px] font-black uppercase tracking-widest">待命位</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* All Partners (Stacked) */}
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-gray-200 border-l-4 border-white/20 pl-4 uppercase tracking-wider">持有夥伴清單</h3>
                    {groupedPartners.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center glass-panel rounded-3xl border border-dashed border-white/10 opacity-50">
                            <Users size={48} className="mb-4" />
                            <p className="font-bold">尚未獲得任何勇者夥伴</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedPartners.map((group) => (
                                <div key={group.base.name} className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all group ${RARITY_COLORS[group.base.rarity].border} ${RARITY_COLORS[group.base.rarity].bg} ${RARITY_COLORS[group.base.rarity].glow} ${group.undeployedIds.length === 0 && group.deployedIds.length > 0 ? 'opacity-80' : 'hover:brightness-125 hover:scale-[1.02]'}`}>
                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-3xl border-2 border-white/10`}>
                                        {group.base.avatar}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="w-full">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-black text-white flex items-center gap-1.5 truncate">
                                                        {group.base.name}
                                                        <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded font-mono">x{group.count}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Stars n={group.base.rarity} />
                                                    <span className="text-[10px] font-black text-game-accent uppercase">戰鬥力 {group.base.power}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <RoleTag role={group.base.role} />
                                            {group.deployedIds.length > 0 && (
                                                <div className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> {group.deployedIds.length} 位上陣
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 min-w-[70px]">
                                        {group.undeployedIds.length > 0 && (
                                            <button
                                                disabled={isCombatAction || currentDeployed.length >= 5}
                                                onClick={() => toggleDeploy(group.undeployedIds[0])}
                                                className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl text-[10px] font-black transition-all border border-emerald-500/30 disabled:opacity-30 flex items-center justify-center gap-1"
                                            >
                                                <PlusCircle size={12} /> 上陣
                                            </button>
                                        )}
                                        {group.deployedIds.length > 0 && (
                                            <button
                                                disabled={isCombatAction}
                                                onClick={() => toggleDeploy(group.deployedIds[0])}
                                                className="w-full py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-[10px] font-black transition-all border border-red-500/30 flex items-center justify-center gap-1"
                                            >
                                                <MinusCircle size={12} /> 撤回
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


