import React, { useState, useEffect } from 'react';
import { Home, Pickaxe, ArrowUpCircle, Hammer, TrendingUp, Users, Plus, X, Star, Clock } from 'lucide-react';
import type { CharacterStats, Building, Partner } from '../types/game';
import { getBuildingUpgradeTime, getBuildingUpgradeGold } from '../types/game';

interface Props { player: CharacterStats; onUpdatePlayer: (a: React.SetStateAction<CharacterStats>) => void; saveProfile: (newState?: CharacterStats) => void; }

// Helper to calculate building bonus
const getBuildingBonus = (b: Building, allPartners: Partner[]) => {
    let goldBonus = 0;
    let matBonus = 0;
    let costReduction = 0;

    const assigned = allPartners.filter(p => b.assignedPartners?.includes(p.id));
    assigned.forEach(p => {
        let mult = p.rarity === 5 ? 0.05 : p.rarity === 4 ? 0.03 : 0.02;
        if (p.role === 'tank' && (b.type === 'material_camp' || b.name.includes('營地') || b.name.includes('工坊'))) {
            matBonus += mult;
        } else if (p.role === 'healer' && b.type === 'gold_mine') {
            goldBonus += mult;
        } else if (p.role === 'dps') {
            let costMult = p.rarity === 5 ? 0.04 : p.rarity === 4 ? 0.02 : 0.01;
            costReduction += costMult;
        }
    });

    return { goldBonus, matBonus, costReduction };
};

export const HomeTab: React.FC<Props> = ({ player, onUpdatePlayer, saveProfile }) => {
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [now, setNow] = useState<number>(Date.now());

    // 每秒更新當前時間，用於計算倒數計時
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const startUpgrade = (b: Building) => {
        const bonus = getBuildingBonus(b, player.partners);
        const finalCost = Math.floor(b.upgradeCost * (1 - bonus.costReduction));
        const finalGoldCost = getBuildingUpgradeGold(b.level);

        if (player.baseMaterials < finalCost) { alert('建材不足！'); return; }
        if (player.gold < finalGoldCost) { alert('金幣不足！'); return; }

        const upgradeDurationMs = getBuildingUpgradeTime(b.level);
        const endsAt = Date.now() + upgradeDurationMs;

        const nextBuildings = player.buildings.map(x => x.id === b.id ? {
            ...x,
            isUpgrading: true,
            upgradeEndsAt: endsAt
        } : x);

        const nextState = {
            ...player,
            baseMaterials: player.baseMaterials - finalCost,
            gold: player.gold - finalGoldCost,
            buildings: nextBuildings,
        };

        onUpdatePlayer(nextState);
        saveProfile(nextState);
    };

    const finishUpgrade = (b: Building) => {
        const nextBuildings = player.buildings.map(x => x.id === b.id ? {
            ...x,
            level: x.level + 1,
            baseProduction: Math.floor(x.baseProduction * 1.5),
            upgradeCost: Math.floor(x.upgradeCost * 2),
            isUpgrading: false,
            upgradeEndsAt: null
        } : x);

        const nextState = {
            ...player,
            buildings: nextBuildings,
        };

        onUpdatePlayer(nextState);
        saveProfile(nextState);
    };

    const formatTimeLeft = (ms: number) => {
        if (ms <= 0) return '0秒';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) return `${hours}小時 ${minutes}分 ${seconds}秒`;
        if (minutes > 0) return `${minutes}分 ${seconds}秒`;
        return `${seconds}秒`;
    };

    const handleAssignPartner = (buildingId: string, partnerId: string) => {
        const nextBuildings = player.buildings.map(b => {
            if (b.id !== buildingId) return b;
            const currentAssigned = b.assignedPartners || [];
            if (currentAssigned.length >= 2) return b;
            return { ...b, assignedPartners: [...currentAssigned, partnerId] };
        });
        const nextState = { ...player, buildings: nextBuildings };
        onUpdatePlayer(nextState);
        saveProfile(nextState);
        setSelectedBuildingId(null);
    };

    const handleUnassignPartner = (buildingId: string, partnerId: string) => {
        const nextBuildings = player.buildings.map(b => {
            if (b.id !== buildingId) return b;
            return { ...b, assignedPartners: (b.assignedPartners || []).filter(id => id !== partnerId) };
        });
        const nextState = { ...player, buildings: nextBuildings };
        onUpdatePlayer(nextState);
        saveProfile(nextState);
    };

    let totalGoldPerMin = 0;
    let totalMatPerMin = 0;

    player.buildings.forEach(b => {
        const bonus = getBuildingBonus(b, player.partners);
        if (b.type === 'gold_mine') {
            totalGoldPerMin += Math.floor(b.baseProduction * (1 + bonus.goldBonus));
        } else if (b.type === 'material_camp') {
            totalMatPerMin += Math.floor(b.baseProduction * (1 + bonus.matBonus));
        }
    });

    return (
        <div className="p-5 h-full overflow-y-auto w-full space-y-5">
            <h2 className="text-xl font-bold flex items-center gap-2"><Home size={20} /> 我的家園</h2>

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

            <div>
                <h3 className="text-base font-bold mb-3 flex items-center gap-2">🏗️ 基地設施</h3>
                <div className="space-y-3">
                    {player.buildings.map((b, i) => {
                        const bonus = getBuildingBonus(b, player.partners);
                        const finalProduction = Math.floor(b.baseProduction * (1 + (b.type === 'gold_mine' ? bonus.goldBonus : bonus.matBonus)));
                        const finalCost = Math.floor(b.upgradeCost * (1 - bonus.costReduction));
                        const finalGoldCost = getBuildingUpgradeGold(b.level);
                        const assignedIds = b.assignedPartners || [];
                        const assignedPartnersData = assignedIds.map(id => player.partners.find(p => p.id === id)).filter(Boolean) as Partner[];

                        return (
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
                                        <div className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
                                            <ArrowUpCircle size={11} /> 產能: {finalProduction}/分鐘
                                            {b.type === 'gold_mine' && bonus.goldBonus > 0 && <span className="text-game-gold text-[9px] ml-1">(+{Math.round(bonus.goldBonus * 100)}%)</span>}
                                            {b.type === 'material_camp' && bonus.matBonus > 0 && <span className="text-orange-400 text-[9px] ml-1">(+{Math.round(bonus.matBonus * 100)}%)</span>}
                                        </div>

                                        <div className="flex gap-2 mt-3">
                                            {[0, 1].map(slotIdx => {
                                                const p = assignedPartnersData[slotIdx];
                                                return p ? (
                                                    <div key={slotIdx} className="bg-black/30 rounded-lg p-1.5 flex items-center gap-2 border border-white/10 relative group w-32 cursor-pointer hover:bg-black/50 transition-colors" onClick={() => handleUnassignPartner(b.id, p.id)} title="點擊卸下">
                                                        <div className="text-xl leading-none">{p.avatar}</div>
                                                        <div className="flex-1 min-w-0 truncate text-[10px] font-bold">
                                                            <div>{p.name}</div>
                                                            <div className="text-[9px] text-emerald-400 flex items-center">已配置</div>
                                                        </div>
                                                        <div className="absolute inset-0 bg-red-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                                                            <X className="text-red-400" size={16} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div key={slotIdx} onClick={() => setSelectedBuildingId(b.id)} className="bg-white/5 hover:bg-white/10 rounded-lg p-1.5 flex items-center justify-center gap-1 border border-dashed border-white/20 cursor-pointer transition-colors w-32 h-10 group">
                                                        <Plus size={14} className="text-gray-400 group-hover:text-white" />
                                                        <span className="text-[10px] text-gray-400 group-hover:text-white">配置夥伴</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full md:w-auto flex flex-col items-center md:items-end border-t md:border-t-0 md:border-l border-gray-700/50 pt-3 md:pt-0 md:pl-4">
                                    <div className="text-[11px] text-gray-400 mb-2 flex flex-col items-center md:items-end gap-1">
                                        <div className="flex items-center gap-1">
                                            <Hammer size={11} /> 升級花費
                                        </div>
                                        <div className="flex flex-col items-center md:items-end gap-0.5">
                                            <div className="flex items-center gap-1">
                                                <span className={player.baseMaterials >= finalCost ? 'text-white font-bold' : 'text-game-danger font-bold'}>{finalCost.toLocaleString()}</span>
                                                <span className="text-[9px]">建材</span>
                                                {bonus.costReduction > 0 && <span className="text-rose-400 text-[9px] line-through ml-1">{b.upgradeCost.toLocaleString()}</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className={player.gold >= finalGoldCost ? 'text-game-gold font-bold' : 'text-game-danger font-bold'}>{finalGoldCost.toLocaleString()}</span>
                                                <span className="text-[9px] text-game-gold">金幣</span>
                                            </div>
                                        </div>
                                    </div>

                                    {b.isUpgrading && b.upgradeEndsAt ? (
                                        now >= b.upgradeEndsAt ? (
                                            <button onClick={() => finishUpgrade(b)}
                                                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-2 px-5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-sm shadow-lg shadow-emerald-500/20">
                                                <ArrowUpCircle size={15} /> 完成升級
                                            </button>
                                        ) : (
                                            <div className="w-full bg-black/40 border border-game-accent/30 text-game-accent font-bold py-2 px-5 rounded-xl flex items-center justify-center gap-1.5 text-sm">
                                                <Clock size={15} className="animate-pulse" />
                                                <span className="font-mono">{formatTimeLeft(b.upgradeEndsAt - now)}</span>
                                            </div>
                                        )
                                    ) : (
                                        <button onClick={() => startUpgrade(b)} disabled={player.baseMaterials < finalCost || player.gold < finalGoldCost}
                                            className="w-full bg-gradient-to-r from-game-accent to-indigo-500 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 text-white font-bold py-2 px-5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-sm shadow-lg shadow-game-accent/15">
                                            <Pickaxe size={15} /> 升級 ({formatTimeLeft(getBuildingUpgradeTime(b.level))})
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-3 bg-white/[0.02] rounded-xl border border-dashed border-gray-700 text-center text-[11px] text-gray-500 mb-10">
                💡 家園設施會持續自動為你生產資源。將未上陣的夥伴配置進設施中，可獲得職業專屬加成！
            </div>

            {selectedBuildingId && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in">
                    <div className="glass-panel w-full max-w-4xl max-h-[80vh] rounded-[30px] p-6 border border-white/10 flex flex-col relative bg-gradient-to-b from-slate-900 to-black overflow-hidden shadow-2xl">
                        <button onClick={() => setSelectedBuildingId(null)} className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 bg-white/5 rounded-full z-10 transition-colors">
                            <X size={20} />
                        </button>

                        <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                            <div className="w-full md:w-64 shrink-0 flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <Users className="text-game-accent" size={24} />
                                    <h3 className="text-xl font-bold">選擇配置夥伴</h3>
                                </div>
                                <div className="text-[11px] text-gray-400 bg-white/5 p-4 rounded-xl border border-white/5 leading-relaxed hidden md:block">
                                    <div className="font-bold text-white mb-2 text-[12px]">設施加成法則</div>
                                    <ul className="list-disc pl-4 space-y-2">
                                        <li><span className="text-blue-400 font-bold">坦克</span> : 建材類產量提升</li>
                                        <li><span className="text-green-400 font-bold">治療</span> : 金幣類產量提升</li>
                                        <li><span className="text-red-400 font-bold">輸出</span> : 降低升級花費</li>
                                    </ul>
                                    <div className="mt-3 text-game-gold font-bold bg-game-gold/10 px-2 py-1 rounded inline-block border border-game-gold/20">⭐️ 星級越高加成越多</div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                                {player.partners.length === 0 ? (
                                    <div className="h-full flex flex-col justify-center items-center opacity-50 text-sm font-bold min-h-[200px]">
                                        <Users size={48} className="mb-4 text-gray-500" />
                                        <p className="text-center text-gray-400">目前沒有夥伴。</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {player.partners.map(p => {
                                            const isDeployed = p.isDeployed;
                                            const otherBuilding = player.buildings.find(b => b.assignedPartners?.includes(p.id));
                                            const isBusy = isDeployed || (otherBuilding !== undefined);

                                            return (
                                                <div
                                                    key={p.id}
                                                    className={`flex items-center gap-3 p-3 rounded-[20px] border transition-all relative overflow-hidden
                                                        ${isBusy
                                                            ? 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed'
                                                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-game-accent/40 cursor-pointer group shadow-sm'
                                                        }`}
                                                    onClick={() => !isBusy && handleAssignPartner(selectedBuildingId!, p.id)}
                                                >
                                                    {!isBusy && <div className="absolute inset-0 bg-gradient-to-br from-game-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                                        <div className="w-14 h-14 bg-black/40 rounded-2xl flex items-center justify-center text-3xl border border-white/10 bg-gradient-to-br from-slate-800 to-black group-hover:scale-105 transition-transform shadow-inner">{p.avatar}</div>
                                                        <div className="text-[10px] font-bold text-gray-500">Lv.{p.level}</div>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-black text-sm flex items-center gap-2 text-white truncate">
                                                            {p.name}
                                                            <span className="text-[10px] text-game-gold bg-game-gold/10 px-1.5 py-0.5 rounded-lg border border-game-gold/20 flex items-center gap-0.5 shrink-0">
                                                                <Star size={8} fill="currentColor" /> {p.rarity}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                            <div className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide border ${p.role === 'tank' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                p.role === 'healer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                    'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                                }`}>
                                                                {p.role === 'tank' ? '坦克' : p.role === 'healer' ? '治療' : '輸出'}
                                                            </div>
                                                            {isBusy && (
                                                                <div className="text-[10px] font-black text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md border border-rose-400/20 flex items-center gap-1">
                                                                    <X size={10} /> {isDeployed ? '戰中' : '設施中'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!isBusy && (
                                                        <button className="h-10 w-10 flex items-center justify-center bg-game-accent/10 text-game-accent group-hover:bg-game-accent group-hover:text-white rounded-xl transition-all border border-game-accent/30 shrink-0 shadow-lg shadow-game-accent/0 group-hover:shadow-game-accent/20">
                                                            <Plus size={20} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
