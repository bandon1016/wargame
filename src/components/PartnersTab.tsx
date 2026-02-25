import React, { useState } from 'react';
import { Star, Sparkles } from 'lucide-react';
import type { Partner, CharacterStats } from '../types/game';
import { RARITY_COLORS } from '../types/game';

interface Props { player: CharacterStats; onUpdatePlayer: (a: React.SetStateAction<CharacterStats>) => void; }

const pool = [
    { name: '聖靈騎士', role: 'tank' as const, rarity: 5 as const, power: 50, avatar: '🛡️' },
    { name: '精靈射手', role: 'dps' as const, rarity: 4 as const, power: 35, avatar: '🏹' },
    { name: '治癒修女', role: 'healer' as const, rarity: 4 as const, power: 25, avatar: '💖' },
    { name: '鐵甲守衛', role: 'tank' as const, rarity: 3 as const, power: 15, avatar: '⚔️' },
    { name: '見習法師', role: 'dps' as const, rarity: 3 as const, power: 20, avatar: '🔮' },
    { name: '流浪劍客', role: 'dps' as const, rarity: 3 as const, power: 18, avatar: '🗡️' },
    { name: '暗影刺客', role: 'dps' as const, rarity: 5 as const, power: 55, avatar: '🥷' },
    { name: '大地祭司', role: 'healer' as const, rarity: 4 as const, power: 30, avatar: '🌿' },
];

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
    <div className="flex">{Array.from({ length: n }).map((_, i) => <Star key={i} size={12} fill="#fbbf24" className="text-game-gold" />)}</div>
);

export const PartnersTab: React.FC<Props> = ({ player, onUpdatePlayer }) => {
    const [anim, setAnim] = useState(false);
    const [drawn, setDrawn] = useState<Partner | null>(null);

    const gacha = () => {
        if (player.gold < 100) { alert('金幣不足！需要 100G'); return; }
        setAnim(true); setDrawn(null);
        onUpdatePlayer(p => ({ ...p, gold: p.gold - 100 }));
        setTimeout(() => {
            const r = Math.random(); let rarity = 3;
            if (r > 0.95) rarity = 5; else if (r > 0.70) rarity = 4;
            const cands = pool.filter(p => p.rarity === rarity);
            const s = cands[Math.floor(Math.random() * cands.length)];
            const np: Partner = { id: Math.random().toString(), ...s, level: 1 };
            setDrawn(np); setAnim(false);
            onUpdatePlayer(p => ({ ...p, partners: [...p.partners, np] }));
        }, 1800);
    };

    return (
        <div className="p-5 h-full overflow-y-auto w-full space-y-5">
            {/* Gacha Banner */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden border border-game-accent/20">
                <div className="absolute inset-0 anim-shimmer pointer-events-none" />
                <Sparkles size={40} className="text-game-gold mb-3 anim-float" />
                <h3 className="text-xl font-bold mb-1">夥伴招募</h3>
                <p className="text-sm text-gray-400 mb-5 max-w-xs">招募強大的夥伴為您提供戰鬥屬性加成</p>
                <button onClick={gacha} disabled={anim}
                    className="bg-gradient-to-r from-game-gold to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-game-dark font-bold text-sm py-3 px-10 rounded-full transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-game-gold/30 flex items-center gap-2">
                    {anim ? <><span className="anim-spin-slow inline-block">✨</span> 召喚中...</> : <>💰 招募 (100 G)</>}
                </button>

                {drawn && !anim && (
                    <div className={`mt-6 p-5 rounded-2xl border-2 w-full max-w-xs anim-scale-in ${RARITY_COLORS[drawn.rarity].border} ${RARITY_COLORS[drawn.rarity].bg} ${RARITY_COLORS[drawn.rarity].glow}`}>
                        <div className="text-game-gold font-bold text-sm mb-3">✨ 獲得新夥伴 ✨</div>
                        <div className="text-4xl mb-2">{drawn.avatar}</div>
                        <Stars n={drawn.rarity} />
                        <div className="font-bold text-lg mt-1">{drawn.name}</div>
                        <div className="flex justify-center gap-2 mt-2">
                            <RoleTag role={drawn.role} />
                            <span className="stat-badge text-[11px]">戰力 {drawn.power}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Roster */}
            <div>
                <h3 className="text-base font-bold mb-3">我的陣容 ({player.partners.length})</h3>
                {player.partners.length === 0 ? (
                    <div className="text-center text-gray-500 py-10 glass-panel rounded-2xl border border-dashed border-gray-700 text-sm">尚未招募任何夥伴</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {player.partners.map((p, i) => (
                            <div key={p.id} className={`glass-panel p-3 rounded-xl flex items-center gap-3 border ${RARITY_COLORS[p.rarity].border} hover:bg-white/5 transition-all anim-slide-in`} style={{ animationDelay: `${i * 50}ms` }}>
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-2xl border ${RARITY_COLORS[p.rarity].border} ${RARITY_COLORS[p.rarity].glow}`}>
                                    {p.avatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className={`font-bold text-sm truncate ${RARITY_COLORS[p.rarity].text}`}>{p.name}</span>
                                        <span className="text-[10px] text-gray-500">Lv.{p.level}</span>
                                    </div>
                                    <Stars n={p.rarity} />
                                    <div className="flex items-center gap-2 mt-1">
                                        <RoleTag role={p.role} />
                                        <span className="text-[11px] text-game-accent font-bold">⚡{p.power}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
