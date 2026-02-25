import React, { useState } from 'react';
import { Map as MapIcon, ChevronRight } from 'lucide-react';
import type { Town, CharacterStats, AlchemyRecipe, BlacksmithRecipe } from '../types/game';
import { ALCHEMY_RECIPES, BLACKSMITH_RECIPES, ITEM_DATABASE, EQUIPMENT_DATABASE, RARITY_COLORS } from '../types/game';

interface TownScreenProps {
    town: Town;
    player: CharacterStats;
    onLeave: () => void;
    onCraftAlchemy: (recipe: AlchemyRecipe) => void;
    onCraftEquipment: (recipe: BlacksmithRecipe) => void;
}

export const TownScreen: React.FC<TownScreenProps> = ({ town, player, onLeave, onCraftAlchemy, onCraftEquipment }) => {
    const [activeFacility, setActiveFacility] = useState<string | null>(null);

    return (
        <div className="fixed inset-0 bg-[#0a0e1a] z-[2000] flex flex-col text-white pb-20 sm:pb-0 overflow-y-auto">
            {/* Header */}
            <div className="relative h-48 flex-shrink-0 bg-gradient-to-br from-indigo-900 to-[#0a0e1a] flex flex-col justify-end p-6 border-b border-indigo-500/30">
                <div className="absolute top-4 left-4">
                    <button onClick={onLeave} className="bg-black/40 p-2 rounded-xl backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors">
                        <MapIcon size={24} />
                    </button>
                </div>
                <h1 className="text-4xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center gap-3">
                    <span style={{ color: town.color }}>🏰</span> {town.name}
                </h1>
                <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-xl">
                    這座繁華的城鎮提供交易與鍛造的服務。探索周遭來收集資源，打造更強的裝備吧！
                </p>
            </div>

            {/* Facilities grid */}
            <div className="p-6 md:p-8 flex-1">
                {!activeFacility ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <h2 className="text-xl font-bold border-l-4 pl-3" style={{ borderColor: town.color }}>城鎮設施</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {town.facilities.includes('market') && (
                                <button onClick={() => setActiveFacility('market')} className="glass-panel p-6 rounded-2xl flex items-center gap-4 text-left transition-all hover:bg-white/5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-yellow-500/20" />
                                    <div className="w-16 h-16 rounded-xl bg-yellow-900/30 border border-yellow-500/30 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(234,179,8,0.2)]">🛒</div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-yellow-100">黑市交易所</div>
                                        <div className="text-xs text-yellow-500/70 mt-1">販售不要的物品，購買珍稀資源。</div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-yellow-400 transition-colors" />
                                </button>
                            )}

                            {town.facilities.includes('blacksmith') && (
                                <button onClick={() => setActiveFacility('blacksmith')} className="glass-panel p-6 rounded-2xl flex items-center gap-4 text-left transition-all hover:bg-white/5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-orange-500/20" />
                                    <div className="w-16 h-16 rounded-xl bg-orange-900/30 border border-orange-500/30 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(249,115,22,0.2)]">🔨</div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-orange-100">鐵匠鍛造坊</div>
                                        <div className="text-xs text-orange-500/70 mt-1">使用在地特產素材，製作並強化頂級裝備。</div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-orange-400 transition-colors" />
                                </button>
                            )}

                            {town.facilities.includes('alchemy') && (
                                <button onClick={() => setActiveFacility('alchemy')} className="glass-panel p-6 rounded-2xl flex items-center gap-4 text-left transition-all hover:bg-white/5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-emerald-500/20" />
                                    <div className="w-16 h-16 rounded-xl bg-emerald-900/30 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">⚗️</div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-emerald-100">鍊金試驗所</div>
                                        <div className="text-xs text-emerald-500/70 mt-1">調配秘藥，合成高階素材與強化BUFF藥水。</div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-emerald-400 transition-colors" />
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <button onClick={() => setActiveFacility(null)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                                <ChevronRight className="rotate-180" size={16} /> 返回城鎮大街
                            </button>
                            <h2 className="text-2xl font-bold">
                                {activeFacility === 'market' ? '🛒 黑市交易所' : activeFacility === 'blacksmith' ? '🔨 鐵匠鍛造坊' : '⚗️ 鍊金試驗所'}
                            </h2>
                        </div>

                        {(activeFacility === 'alchemy' || activeFacility === 'blacksmith') ? (
                            <div className="flex-1 w-full flex flex-col md:flex-row gap-6">
                                {/* Left Side: Player Inventory for crafting materials */}
                                <div className="w-full md:w-1/3 glass-panel p-6 rounded-2xl flex flex-col h-full bg-[#0a0e1a]/80">
                                    <h3 className="text-emerald-400 font-bold mb-4 border-b border-emerald-500/20 pb-2 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-emerald-900/50 flex flex-col items-center justify-center text-xs">🎒</div>
                                        擁有素材
                                    </h3>
                                    <div className="flex items-center gap-3 mb-4 bg-yellow-900/20 p-3 rounded-xl border border-yellow-500/10">
                                        <span className="text-xl">💰</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-game-gold">持有金幣</div>
                                            <div className="font-bold">{Math.floor(player.gold)}</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {player.items.filter(i => i.type === 'material' || i.type === 'gem').map(item => (
                                            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 text-sm">
                                                <div className="text-xl">{item.icon}</div>
                                                <div className="flex-1 truncate">{item.name}</div>
                                                <div className="font-bold tabular-nums text-gray-300">x{item.quantity}</div>
                                            </div>
                                        ))}
                                        {player.items.filter(i => i.type === 'material' || i.type === 'gem').length === 0 && (
                                            <div className="text-center text-gray-500 py-8 text-sm">
                                                背包內沒有可用的材料
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Recipes */}
                                <div className="w-full md:w-2/3 glass-panel p-6 rounded-2xl flex flex-col h-full bg-[#0a0e1a]/80">
                                    <h3 className="text-emerald-400 font-bold mb-4 border-b border-emerald-500/20 pb-2">配方列表</h3>
                                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                        {activeFacility === 'alchemy' && ALCHEMY_RECIPES.map(recipe => {
                                            const targetItemDef = ITEM_DATABASE.find(i => i.id === recipe.targetItemId);
                                            if (!targetItemDef) return null;

                                            // Check requirements
                                            const hasGold = player.gold >= recipe.goldCost;
                                            let hasAllMats = true;
                                            const matStatuses = recipe.materials.map(matReq => {
                                                const inventoryCount = player.items.find(i => i.id === matReq.id)?.quantity ?? 0;
                                                const meets = inventoryCount >= matReq.quantity;
                                                if (!meets) hasAllMats = false;
                                                return { ...matReq, inventoryCount, meets };
                                            });
                                            const canCraft = hasGold && hasAllMats;

                                            return (
                                                <div key={recipe.id} className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 flex flex-col md:flex-row gap-4 items-start md:items-center">

                                                    {/* Output Item */}
                                                    <div className="flex items-center gap-3 w-48">
                                                        <div className="w-12 h-12 flex-shrink-0 bg-emerald-900/30 rounded-lg border border-emerald-500/30 flex items-center justify-center text-2xl drop-shadow-md">
                                                            {targetItemDef.icon}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-emerald-100">{targetItemDef.name}</div>
                                                            <div className="text-[10px] text-gray-400 leading-tight mt-0.5 line-clamp-2" title={targetItemDef.description}>{targetItemDef.description}</div>
                                                        </div>
                                                    </div>

                                                    {/* Ingredients */}
                                                    <div className="flex-1 w-full bg-black/30 rounded-lg p-2 flex flex-wrap gap-2 text-xs">
                                                        {matStatuses.map(ms => {
                                                            const matDefIcon = ITEM_DATABASE.find(i => i.id === ms.id)?.icon || '❓';
                                                            return (
                                                                <div key={ms.id} className={`flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border ${ms.meets ? 'border-green-500/30 text-green-300' : 'border-red-500/30 text-red-400'}`}>
                                                                    <span>{matDefIcon}</span>
                                                                    <span>{ms.name}</span>
                                                                    <span className="opacity-60 pl-1">{ms.inventoryCount}/{ms.quantity}</span>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border ${hasGold ? 'border-yellow-500/30 text-yellow-300' : 'border-red-500/30 text-red-400'}`}>
                                                            <span>💰</span>金幣 <span className="opacity-60 pl-1">{Math.floor(player.gold)}/{recipe.goldCost}</span>
                                                        </div>
                                                    </div>

                                                    {/* Action */}
                                                    <div className="mt-2 md:mt-0 flex-shrink-0 w-full md:w-auto">
                                                        <button
                                                            onClick={() => onCraftAlchemy(recipe)}
                                                            disabled={!canCraft}
                                                            className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${canCraft ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
                                                        >
                                                            調配
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {activeFacility === 'blacksmith' && BLACKSMITH_RECIPES.map(recipe => {
                                            const targetEquipDef = EQUIPMENT_DATABASE.find(i => i.id === recipe.targetEquipmentId);
                                            if (!targetEquipDef) return null;

                                            // Check requirements
                                            const hasGold = player.gold >= recipe.goldCost;
                                            let hasAllMats = true;
                                            const matStatuses = recipe.materials.map(matReq => {
                                                const inventoryCount = player.items.find(i => i.id === matReq.id)?.quantity ?? 0;
                                                const meets = inventoryCount >= matReq.quantity;
                                                if (!meets) hasAllMats = false;
                                                return { ...matReq, inventoryCount, meets };
                                            });
                                            const canCraft = hasGold && hasAllMats;
                                            const rarityColors = RARITY_COLORS[targetEquipDef.rarity];

                                            return (
                                                <div key={recipe.id} className={`p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border flex flex-col md:flex-row gap-4 items-start md:items-center ${rarityColors.border}`}>

                                                    {/* Output Item */}
                                                    <div className="flex items-center gap-3 w-48">
                                                        <div className={`w-12 h-12 flex-shrink-0 rounded-lg border flex items-center justify-center text-2xl drop-shadow-md ${rarityColors.border} ${rarityColors.bg}`}>
                                                            {targetEquipDef.icon}
                                                        </div>
                                                        <div>
                                                            <div className={`font-bold ${rarityColors.text}`}>{targetEquipDef.name}</div>
                                                            <div className="text-[10px] text-gray-400 mt-1 flex gap-2">
                                                                {targetEquipDef.attack > 0 && <span className="text-red-400">ATK +{targetEquipDef.attack}</span>}
                                                                {targetEquipDef.defense > 0 && <span className="text-blue-400">DEF +{targetEquipDef.defense}</span>}
                                                                {targetEquipDef.hp > 0 && <span className="text-green-400">HP +{targetEquipDef.hp}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Ingredients */}
                                                    <div className="flex-1 w-full bg-black/30 rounded-lg p-2 flex flex-wrap gap-2 text-xs">
                                                        {matStatuses.map(ms => {
                                                            const matDefIcon = ITEM_DATABASE.find(i => i.id === ms.id)?.icon || '❓';
                                                            return (
                                                                <div key={ms.id} className={`flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border ${ms.meets ? 'border-orange-500/30 text-orange-300' : 'border-red-500/30 text-red-400'}`}>
                                                                    <span>{matDefIcon}</span>
                                                                    <span>{ms.name}</span>
                                                                    <span className="opacity-60 pl-1">{ms.inventoryCount}/{ms.quantity}</span>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border ${hasGold ? 'border-yellow-500/30 text-yellow-300' : 'border-red-500/30 text-red-400'}`}>
                                                            <span>💰</span>金幣 <span className="opacity-60 pl-1">{Math.floor(player.gold)}/{recipe.goldCost}</span>
                                                        </div>
                                                    </div>

                                                    {/* Action */}
                                                    <div className="mt-2 md:mt-0 flex-shrink-0 w-full md:w-auto">
                                                        <button
                                                            onClick={() => onCraftEquipment(recipe)}
                                                            disabled={!canCraft}
                                                            className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${canCraft ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
                                                        >
                                                            鍛造
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 glass-panel rounded-3xl border border-white/10 p-8 flex flex-col items-center justify-center text-center">
                                <div className="text-6xl mb-6 opacity-50 animate-bounce">
                                    {activeFacility === 'market' ? '💰' : '❓'}
                                </div>
                                <h3 className="text-xl font-bold mb-2">設施功能尚未開放</h3>
                                <p className="text-gray-400 max-w-sm">
                                    工匠們仍在努力建設中，敬請期待未來的更新內容！
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};