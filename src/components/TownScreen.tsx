import React, { useState, useEffect } from 'react';
import { Map as MapIcon, ChevronRight, TrainFront, ClipboardList, Anchor, Ship, Coins, ShoppingBag, Trash2, Loader2, PlusCircle, CheckCircle, RefreshCw } from 'lucide-react';
import type { Town, CharacterStats, AlchemyRecipe, BlacksmithRecipe, Equipment } from '../types/game';
import { ALCHEMY_RECIPES, BLACKSMITH_RECIPES, ITEM_DATABASE, EQUIPMENT_DATABASE, RARITY_COLORS, TOWN_DATABASE, CITY_QUEST_POOL, getRailwayPath } from '../types/game';
import { supabase } from '../lib/supabase';

const CURRENCY_ICONS: Record<string, string> = {
    lingQi: '🌿',
    techFragments: '⚙️',
    incense: '🕯️',
    saltCrystals: '🌊',
    premiumGems: '💎',
};

interface TownScreenProps {
    town: Town;
    player: CharacterStats;
    userId: string;
    onLeave: () => void;
    onCraftAlchemy: (recipe: AlchemyRecipe) => void;
    onCraftEquipment: (recipe: BlacksmithRecipe) => void;
    forgingRecipeId?: string | null;
    onTravel: (destination: Town) => void;
    onSellEquipment: (equipment: Equipment) => void;
    quests?: any[];
    onRefreshQuests?: () => void;
    initialFacility?: 'market' | 'alchemy' | 'blacksmith' | 'station' | 'quest_board' | 'shipyard' | 'dock' | null;
}

const FACILITY_NPCS = {
    market: { name: '商人 阿財', avatar: '👨‍💼', dialogue: '嘿！勇者，我這有些剛進的好料，或是你想處理掉背包裡的破銅難鐵？' },
    blacksmith: { name: '老鐵匠 魯恩', avatar: '🧔', dialogue: '爐火正旺，這塊鐵看起來能打造成不錯的兵器。有興趣強化你的裝備嗎？' },
    alchemy: { name: '鍊金術師 艾拉', avatar: '🧙‍♀️', dialogue: '藥草的比例是門學問。只要素材足夠，我能幫你調配出恢復生命甚至更強大的秘藥。' },
    station: { name: '站務員 李大叔', avatar: '👨‍✈️', dialogue: '歡迎來到本站！火車非常準時，請確定目的地後再購票入站。' },
    quest_board: { name: '衛兵 小謝', avatar: '💂', dialogue: '大家都在忙，佈告欄上面都是這陣子的委託，挑一個適合你的吧。' },
    shipyard: { name: '船匠 豪哥', avatar: '🧑‍🔧', dialogue: '想去海那邊瞧瞧？船隻可是很講究材料質地的，先準備好木頭再來。' },
    dock: { name: '老船長 傑克', avatar: '⚓', dialogue: '起風了！只要你有一艘好船，大海就是你的地圖。隨時準備出航！' },
};

export const TownScreen: React.FC<TownScreenProps> = ({ town, player, userId, onLeave, onCraftAlchemy, onCraftEquipment, onTravel, onSellEquipment, forgingRecipeId, quests, onRefreshQuests, initialFacility }) => {
    const [activeFacility, setActiveFacility] = useState<'inn' | 'market' | 'alchemy' | 'blacksmith' | 'station' | 'quest_board' | 'shipyard' | 'dock' | null>(initialFacility ?? null);
    const [localQuests, setLocalQuests] = useState<any[]>(quests || []);
    const [accepting, setAccepting] = useState<string | null>(null);

    // Sync or Fetch quests when entering quest board
    useEffect(() => {
        if (activeFacility === 'quest_board') {
            fetchCurrentQuests();
        }
    }, [activeFacility]);

    const fetchCurrentQuests = async () => {
        const { data, error } = await supabase.rpc('get_or_reset_daily_quests', {
            p_user_id: userId,
            p_city_id: town.id
        });
        if (!error && data) {
            setLocalQuests(data);
            if (onRefreshQuests) onRefreshQuests();
        }
    };

    const handleAcceptQuest = async (questId: string) => {
        setAccepting(questId);
        try {
            const { data, error } = await supabase.rpc('accept_city_quest', {
                p_quest_id: questId,
                p_city_id: town.id
            });

            if (error) {
                alert(`接取失敗: ${error.message}`);
            } else if (data && data.success) {
                alert(data.message);
                fetchCurrentQuests(); // Refresh to show accepted status
            } else {
                alert(data?.message || '接取失敗');
            }
        } catch (err: any) {
            alert(`連線錯誤: ${err.message}`);
        } finally {
            setAccepting(null);
        }
    };

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

                            {town.facilities.includes('station') && (
                                <button onClick={() => setActiveFacility('station')} className="glass-panel p-6 rounded-2xl flex items-center gap-4 text-left transition-all hover:bg-white/5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-sky-500/20" />
                                    <div className="w-16 h-16 rounded-xl bg-sky-900/30 border border-sky-500/30 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(14,165,233,0.2)]">
                                        <TrainFront className="text-sky-400" size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-sky-100">城市火車站</div>
                                        <div className="text-xs text-sky-500/70 mt-1">搭乘火車快速往返於各大主要城市。</div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-sky-400 transition-colors" />
                                </button>
                            )}

                            {town.facilities.includes('quest_board') && (
                                <button onClick={() => setActiveFacility('quest_board')} className="glass-panel p-6 rounded-2xl flex items-center gap-4 text-left transition-all hover:bg-white/5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-yellow-500/20" />
                                    <div className="w-16 h-16 rounded-xl bg-yellow-900/30 border border-yellow-500/30 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                                        <ClipboardList className="text-yellow-400" size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-yellow-100">任務佈告欄</div>
                                        <div className="text-xs text-yellow-500/70 mt-1">承接市民委託，獲取豐厚報酬。</div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-yellow-400 transition-colors" />
                                </button>
                            )}

                            {town.facilities.includes('shipyard') && (
                                <button onClick={() => setActiveFacility('shipyard')} className="glass-panel p-6 rounded-2xl flex items-center gap-4 text-left transition-all hover:bg-white/5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-500/20" />
                                    <div className="w-16 h-16 rounded-xl bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                        <Ship className="text-blue-400" size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-blue-100">港口造船廠</div>
                                        <div className="text-xs text-blue-500/70 mt-1">打造與升級船隻，準備出航。</div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                                </button>
                            )}

                            {town.facilities.includes('dock') && (
                                <button onClick={() => setActiveFacility('dock')} className="glass-panel p-6 rounded-2xl flex items-center gap-4 text-left transition-all hover:bg-white/5 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-cyan-500/20" />
                                    <div className="w-16 h-16 rounded-xl bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                        <Anchor className="text-cyan-400" size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg text-cyan-100">客運碼頭</div>
                                        <div className="text-xs text-cyan-500/70 mt-1">搭乘船隻出發，探索未知海域與離島。</div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
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
                                {activeFacility === 'market' ? '🛒 黑市交易所' :
                                    activeFacility === 'blacksmith' ? '🔨 鐵匠鍛造坊' :
                                        activeFacility === 'station' ? '🚆 城市火車站' :
                                            activeFacility === 'quest_board' ? '📋 任務佈告欄' :
                                                activeFacility === 'shipyard' ? '⛴️ 港口造船廠' :
                                                    activeFacility === 'dock' ? '⚓ 客運碼頭' :
                                                        '⚗️ 鍊金試驗所'}
                            </h2>
                        </div>

                        {/* NPC Section */}
                        {activeFacility && (
                            <div className="mb-6 flex items-start gap-4 animate-fade-in shrink-0">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/20 flex items-center justify-center text-4xl shadow-lg shrink-0">
                                    {FACILITY_NPCS[activeFacility as keyof typeof FACILITY_NPCS]?.avatar || '👤'}
                                </div>
                                <div className="relative bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none flex-1 backdrop-blur-md">
                                    <div className="absolute -left-2 top-0 w-2 h-2 bg-white/5 border-t border-l border-white/10 -rotate-45" />
                                    <div className="text-xs font-black text-game-accent mb-1 uppercase tracking-wider">
                                        {FACILITY_NPCS[activeFacility as keyof typeof FACILITY_NPCS]?.name || '神秘人物'}
                                    </div>
                                    <p className="text-sm text-gray-200 leading-relaxed italic">
                                        「{FACILITY_NPCS[activeFacility as keyof typeof FACILITY_NPCS]?.dialogue || '歡迎來到此地，勇者。'}」
                                    </p>
                                </div>
                            </div>
                        )}

                        {(activeFacility === 'alchemy' || activeFacility === 'blacksmith') ? (
                            <div className="flex-1 w-full flex flex-col md:flex-row-reverse gap-6">
                                {/* Right Side: Player Inventory for crafting materials */}
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

                                {/* Left Side: Recipes */}
                                <div className="w-full md:w-2/3 glass-panel p-6 rounded-2xl flex flex-col h-full bg-[#0a0e1a]/80">
                                    <h3 className="text-emerald-400 font-bold mb-4 border-b border-emerald-500/20 pb-2">配方列表</h3>
                                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                        {activeFacility === 'alchemy' && ALCHEMY_RECIPES.filter(r => !r.cityId || r.cityId === town.id).map(recipe => {
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

                                        {activeFacility === 'blacksmith' && BLACKSMITH_RECIPES.filter(r => !r.cityId || r.cityId === town.id).map(recipe => {
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
                                                            disabled={!canCraft || forgingRecipeId !== null}
                                                            className={`w-full md:w-auto px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${canCraft && forgingRecipeId === null ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
                                                        >
                                                            {forgingRecipeId === recipe.id ? (
                                                                <span className="flex items-center gap-2">
                                                                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                                                    鍛造中...
                                                                </span>
                                                            ) : '鍛造'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : activeFacility === 'station' ? (
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="glass-panel p-6 rounded-3xl border border-sky-500/20 bg-sky-900/10">
                                    <h3 className="text-sky-400 font-bold mb-4 flex items-center gap-2 text-lg">
                                        <TrainFront size={20} /> 車站時刻表
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
                                        {TOWN_DATABASE.filter(t => t.id !== town.id).map(dest => {
                                            const getDistanceLocal = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                                                const R = 6371e3;
                                                const d1 = lat1 * Math.PI / 180;
                                                const d2 = lat2 * Math.PI / 180;
                                                const dr = (lat2 - lat1) * Math.PI / 180;
                                                const dl = (lon2 - lon1) * Math.PI / 180;
                                                const a = Math.sin(dr / 2) * Math.sin(dr / 2) + Math.cos(d1) * Math.cos(d2) * Math.sin(dl / 2) * Math.sin(dl / 2);
                                                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                            };
                                            const dist = getDistanceLocal(town.lat, town.lng, dest.lat, dest.lng);
                                            const cost = Math.max(50, Math.floor(dist / 100));
                                            const canAfford = player.gold >= cost;

                                            // Calculate estimated time based on 0.0008 units per frame at ~60fps
                                            const path = getRailwayPath(town.id, dest.id);
                                            const pathLength = Math.max(0, path.length - 1);
                                            const estimatedSeconds = Math.ceil(pathLength / (0.0008 * 60));
                                            const timeDisplay = estimatedSeconds > 60
                                                ? `${Math.floor(estimatedSeconds / 60)}m ${estimatedSeconds % 60}s`
                                                : `${estimatedSeconds}s`;

                                            return (
                                                <div key={dest.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-all group">
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl shrink-0" style={{ backgroundColor: dest.color + '20', border: `2px solid ${dest.color}` }}>
                                                        🏰
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-lg text-white group-hover:text-game-accent transition-colors">
                                                            {dest.name} <span className="text-xs text-gray-400 font-normal ml-1">({timeDisplay})</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                                                            <span className="flex items-center gap-1"><MapIcon size={12} /> {Math.round(dist / 1000)} km</span>
                                                            <span className={`flex items-center gap-1 font-bold ${canAfford ? 'text-game-gold' : 'text-game-danger'}`}>💰 {cost}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onTravel(dest)}
                                                        disabled={!canAfford}
                                                        className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 ${canAfford ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/40' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
                                                    >
                                                        前往
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="text-center text-gray-500 text-xs italic">
                                    ※ 票價依照城市間的物理距離計算 (100公尺 / 1金幣)
                                </div>
                            </div>
                        ) : activeFacility === 'quest_board' ? (
                            <div className="flex-1 flex flex-col gap-6 h-full min-h-0">
                                <div className="glass-panel p-6 rounded-3xl border border-yellow-500/20 bg-yellow-900/10 flex flex-col h-full min-h-0">
                                    <h3 className="text-yellow-400 font-bold mb-6 flex items-center justify-between text-lg">
                                        <div className="flex items-center gap-2">
                                            <ClipboardList size={20} />在地委託佈告欄
                                        </div>
                                        <div className="text-xs font-normal text-gray-400 italic">「守護{town.name}並非口號，而是實際的行動。」</div>
                                    </h3>

                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                                        {(() => {
                                            const cityQuests = (CITY_QUEST_POOL || []).filter(q => q.cityId === town.id);

                                            if (cityQuests.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                                        <span className="text-4xl mb-4">📭</span>
                                                        <p>此地暫無特殊委託，請前往其他城市看看吧！</p>
                                                    </div>
                                                );
                                            }

                                            return cityQuests.map(q => {
                                                const isWeekly = q.isWeekly;
                                                const activeQuest = localQuests.find(lq => lq.quest_id === q.id);
                                                const isAccepted = !!activeQuest;
                                                const isClaimed = activeQuest?.claimed;
                                                const progress = activeQuest?.progress || 0;
                                                const isComplete = progress >= q.required;

                                                return (
                                                    <div key={q.id} className={`p-6 rounded-[2rem] bg-white/5 border ${isClaimed ? 'border-emerald-500/20 opacity-60' : isComplete ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.1)]' : isWeekly ? 'border-amber-500/30' : 'border-white/10'} flex flex-col gap-5 hover:bg-white/10 transition-all group`}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex gap-4">
                                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 bg-white/5 border border-white/5`}>
                                                                    {isClaimed ? '✅' : isWeekly ? '💎' : '📜'}
                                                                </div>
                                                                <div>
                                                                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isClaimed ? 'text-emerald-400' : isWeekly ? 'text-amber-400' : 'text-game-accent'}`}>
                                                                        {isClaimed ? '委託已完成' : isWeekly ? '本週精選委託' : '在地日常委託'}
                                                                    </div>
                                                                    <div className="font-black text-xl text-white group-hover:text-game-accent transition-colors">{q.title}</div>
                                                                    <div className="text-xs text-gray-400 mt-1 max-w-[400px] leading-relaxed line-clamp-2 italic">「{q.description}」</div>
                                                                </div>
                                                            </div>

                                                            {!isAccepted ? (
                                                                <button
                                                                    onClick={() => handleAcceptQuest(q.id)}
                                                                    disabled={!!accepting}
                                                                    className="px-6 py-3 bg-game-accent hover:bg-sky-400 text-white font-black rounded-2xl shadow-lg shadow-sky-900/40 transition-all active:scale-90 flex items-center gap-2 group/btn"
                                                                >
                                                                    {accepting === q.id ? <Loader2 className="animate-spin" size={18} /> : <PlusCircle size={18} className="group-hover/btn:rotate-90 transition-transform" />}
                                                                    接取委託
                                                                </button>
                                                            ) : isClaimed ? (
                                                                <div className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-sm font-black flex items-center gap-2">
                                                                    <CheckCircle size={16} /> 委託結案
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-end gap-1.5">
                                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">委託進行中</div>
                                                                    <div className="px-5 py-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl text-sm font-black flex items-center gap-2">
                                                                        <RefreshCw size={16} className="animate-spin-slow" /> 進度 {progress} / {q.required}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Reward visualization */}
                                                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-wrap gap-4 items-center">
                                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mr-2">報酬</div>
                                                            <div className="flex items-center gap-2 bg-amber-400/5 px-3 py-1.5 rounded-xl border border-amber-400/10 group-hover:bg-amber-400/10 transition-colors">
                                                                <span className="text-sm">💰</span>
                                                                <span className="text-xs font-black text-amber-400">{q.reward.gold}G</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-indigo-400/5 px-3 py-1.5 rounded-xl border border-indigo-400/10 group-hover:bg-indigo-400/10 transition-colors">
                                                                <span className="text-sm">✨</span>
                                                                <span className="text-xs font-black text-indigo-300">{q.reward.exp} EXP</span>
                                                            </div>
                                                            {q.reward.currency && (
                                                                <div className="flex items-center gap-2 bg-emerald-400/5 px-3 py-1.5 rounded-xl border border-emerald-400/10 group-hover:bg-emerald-400/10 transition-colors">
                                                                    <span className="text-sm">{CURRENCY_ICONS[q.reward.currency.type] || '💎'}</span>
                                                                    <span className="text-xs font-black text-emerald-400">{q.reward.currency.amount} {q.reward.currency.type === 'lingQi' ? '靈氣' : q.reward.currency.type === 'incense' ? '香火' : '素材'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                                <div className="text-center text-gray-500 text-[10px] italic">
                                    ※ 如果佈告欄內容未出現在【任務】選單，請確認任務庫是否已滿。
                                </div>
                            </div>
                        ) : activeFacility === 'shipyard' ? (
                            <div className="flex-1 w-full flex flex-col items-center justify-center text-center">
                                <Ship size={64} className="text-blue-500/50 mb-4" />
                                <h3 className="text-xl font-bold text-gray-300 mb-2">🚧 造船廠修建中 🚧</h3>
                                <p className="text-gray-500 max-w-md">工匠們正在研發能夠在狂風巨浪中航行的新型船隻，未來您將能在此消耗木材打造專屬戰船！</p>
                            </div>
                        ) : activeFacility === 'dock' ? (
                            <div className="flex-1 w-full flex flex-col items-center justify-center text-center">
                                <Anchor size={64} className="text-cyan-500/50 mb-4" />
                                <h3 className="text-xl font-bold text-gray-300 mb-2">🚧 碼頭航運籌備中 🚧</h3>
                                <p className="text-gray-500 max-w-md">通往未知海域與美麗離島的航線正在探勘中，當您擁有船隻後，便能從此處揚帆啟航！</p>
                            </div>
                        ) : activeFacility === 'market' ? (
                            <div className="flex-1 flex flex-col gap-6 h-full min-h-0">
                                <div className="glass-panel p-6 rounded-3xl border border-yellow-500/20 bg-yellow-900/10 flex flex-col h-full min-h-0">
                                    <h3 className="text-yellow-400 font-bold mb-4 flex items-center justify-between text-lg">
                                        <div className="flex items-center gap-2">
                                            <ShoppingBag size={20} /> 裝備收購回扣
                                        </div>
                                        <div className="text-xs font-normal text-gray-400 italic">「品相不限，只要是寶貝我都要！」</div>
                                    </h3>

                                    {/* Un-equipped Equipment List */}
                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                        {(() => {
                                            const equippedIds = [
                                                player.equippedWeapon?.id,
                                                player.equippedArmor?.id,
                                                player.equippedHelmet?.id,
                                                player.equippedBoots?.id,
                                                player.equippedAccessory?.id
                                            ].filter(Boolean);

                                            const sellable = player.equipment.filter(e => !equippedIds.includes(e.id));

                                            if (sellable.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                                        <Trash2 size={48} className="opacity-20 mb-3" />
                                                        <p>背包中目前沒有多餘的裝備可供收購</p>
                                                    </div>
                                                );
                                            }

                                            return sellable.map(eq => {
                                                const rarityColors = RARITY_COLORS[eq.rarity as keyof typeof RARITY_COLORS];
                                                const sellPrice = Math.floor(100 * Math.pow(5, eq.rarity - 1));

                                                return (
                                                    <div key={eq.id} className={`p-4 rounded-2xl bg-white/5 border ${rarityColors.border} flex items-center gap-4 transition-all hover:bg-white/10 group`}>
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${rarityColors.bg} ${rarityColors.glow}`}>
                                                            {eq.icon}
                                                        </div>
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className={`font-bold truncate ${rarityColors.text}`}>{eq.name}</div>
                                                            <div className="text-[10px] text-gray-400 flex gap-2 mt-1">
                                                                {eq.attack > 0 && <span>ATK +{eq.attack}</span>}
                                                                {eq.defense > 0 && <span>DEF +{eq.defense}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                                            <div className="flex items-center gap-1 text-game-gold font-black">
                                                                <Coins size={14} /> {sellPrice.toLocaleString()}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm(`確定要以 ${sellPrice} 金幣賣出【${eq.name}】嗎？`)) {
                                                                        onSellEquipment(eq);
                                                                    }
                                                                }}
                                                                className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                                            >
                                                                賣出
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                                <div className="text-center text-gray-500 text-[10px] italic">
                                    ※ 現正熱售：公道收購，童叟無欺。未裝備之物品方可出售。
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 w-full flex flex-col items-center justify-center text-center">
                                <span className="text-4xl mb-4">❓</span>
                                <h3 className="text-xl font-bold text-gray-300">功能開發中</h3>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
