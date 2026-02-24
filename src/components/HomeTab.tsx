import React from 'react';
import { Home, Pickaxe, ArrowUpCircle, Hammer, TrendingUp } from 'lucide-react';
import type { CharacterStats, Building } from '../types/game';

interface Props { player: CharacterStats; onUpdatePlayer: (a: React.SetStateAction<CharacterStats>) => void; }

export const HomeTab: React.FC<Props> = ({ player, onUpdatePlayer }) => {
    const upgrade = (b: Building) => {
        if (player.baseMaterials < b.upgradeCost) { alert('建材不足！'); return; }
        onUpdatePlayer(p => ({
            ...p,
            baseMaterials: p.baseMaterials - b.upgradeCost,
            buildings: p.buildings.map(x => x.id === b.id ? {
                ...x, level: x.level + 1,
                baseProduction: Math.floor(x.baseProduction * 1.5),
                upgradeCost: Math.floor(x.upgradeCost * 2),
            } : x),
        }));
    };

    const totalGoldPerMin = player.buildings.filter(b => b.type === 'gold_mine').reduce((s, b) => s + b.baseProduction, 0);
    const totalMatPerMin = player.buildings.filter(b => b.type === 'material_camp').reduce((s, b) => s + b.baseProduction, 0);

    return (
        <div className="p-5 h-full overflow-y-auto w-full space-y-5">
            <h2 className="text-xl font-bold flex items-center gap-2"><Home size={20} /> 我的家園</h2>

            {/* Resources */}
            <div className="grid grid-cols-2 gap-3">
                <div className="glass-panel p-4 rounded-xl flex items-center gap-3 border border-game-gold/20">
                    <div className="w-11 h-11 bg-game-gold/10 rounded-xl flex items-center justify-center text-xl">💰</div>
                    <div>
                        <div className="text-[11px] text-gray-400">金幣</div>
                        <div className="text-xl font-bold text-game-gold tabular-nums">{Math.floor(player.gold)}</div>
                        <div className="text-[10px] text-green-400 flex items-center gap-0.5"><TrendingUp size={10} /> +{totalGoldPerMin}/分</div>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl flex items-center gap-3 border border-gray-500/20">
                    <div className="w-11 h-11 bg-gray-500/10 rounded-xl flex items-center justify-center text-xl">🧱</div>
                    <div>
                        <div className="text-[11px] text-gray-400">建材</div>
                        <div className="text-xl font-bold tabular-nums">{Math.floor(player.baseMaterials)}</div>
                        <div className="text-[10px] text-green-400 flex items-center gap-0.5"><TrendingUp size={10} /> +{totalMatPerMin}/分</div>
                    </div>
                </div>
            </div>

            {/* Buildings */}
            <div>
                <h3 className="text-base font-bold mb-3 flex items-center gap-2">🏗️ 基地設施</h3>
                <div className="space-y-3">
                    {player.buildings.map((b, i) => (
                        <div key={b.id} className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center anim-slide-in" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className="flex items-center gap-4 flex-1 w-full">
                                <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center text-3xl border border-gray-600 flex-shrink-0">
                                    {b.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold flex items-center gap-2">
                                        {b.name}
                                        <span className="text-[10px] bg-game-accent/10 text-game-accent px-2 py-0.5 rounded-full border border-game-accent/30">Lv.{b.level}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">{b.description}</div>
                                    <div className="text-[11px] text-green-400 mt-1 flex items-center gap-1"><ArrowUpCircle size={11} /> 產能: {b.baseProduction}/分鐘</div>
                                </div>
                            </div>
                            <div className="w-full md:w-auto flex flex-col items-center md:items-end border-t md:border-t-0 md:border-l border-gray-700/50 pt-3 md:pt-0 md:pl-4">
                                <div className="text-[11px] text-gray-400 mb-2 flex items-center gap-1">
                                    <Hammer size={11} /> 需要 <span className={player.baseMaterials >= b.upgradeCost ? 'text-white font-bold' : 'text-game-danger font-bold'}>{b.upgradeCost}</span> 建材
                                </div>
                                <button onClick={() => upgrade(b)} disabled={player.baseMaterials < b.upgradeCost}
                                    className="w-full bg-gradient-to-r from-game-accent to-indigo-500 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 text-white font-bold py-2 px-5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-sm shadow-lg shadow-game-accent/15">
                                    <Pickaxe size={15} /> 升級
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-3 bg-white/[0.02] rounded-xl border border-dashed border-gray-700 text-center text-[11px] text-gray-500">
                💡 家園設施會持續自動為你生產資源。升級設施可以加速產出！
            </div>
        </div>
    );
};
