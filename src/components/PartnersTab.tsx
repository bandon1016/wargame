import React, { useState, useMemo } from 'react';
import { Star, Sparkles, UserPlus, Users, ShieldAlert, CheckCircle2, MinusCircle, PlusCircle, Loader2, X, Zap, AlertTriangle, ArrowRight, Home, Flame, Diamond, Search, Info } from 'lucide-react';
import type { Partner, CharacterStats, God } from '../types/game';
import { RARITY_COLORS, getPartnerAvatar } from '../types/game';
import { supabase } from '../lib/supabase';

interface Props {
    player: CharacterStats;
    onUpdatePlayer: (a: React.SetStateAction<CharacterStats>) => void;
    saveProfile: (p: CharacterStats) => void;
    isCombatAction: boolean;
    mapServerProfile: (data: any) => CharacterStats;
}

const getLatestAvatar = getPartnerAvatar;

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

export const PartnersTab: React.FC<Props> = ({ player, onUpdatePlayer, saveProfile, isCombatAction, mapServerProfile }) => {
    const [anim, setAnim] = useState(false);
    const [drawn, setDrawn] = useState<Partner[] | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Godly Sanctuary states
    const [isSanctuaryOpen, setIsSanctuaryOpen] = useState(false);
    const [drawGodResult, setDrawGodResult] = useState<God | null>(null);
    const [godDrawLoading, setGodDrawLoading] = useState(false);

    // Synthesis states
    const [isSynthesisModalOpen, setIsSynthesisModalOpen] = useState(false);
    const [synthRarity, setSynthRarity] = useState<3 | 4>(3);
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
    const [synthAnim, setSynthAnim] = useState(false);
    const [synthResults, setSynthResults] = useState<Partner[] | null>(null);
    const [synthSuccessCount, setSynthSuccessCount] = useState<number>(0);

    const openSynthesisModal = () => {
        setIsSynthesisModalOpen(true);
        setSynthRarity(3);
        setSelectedMaterials([]);
        setSynthResults(null);
        setSynthSuccessCount(0);
        setSynthAnim(false);
    };

    const toggleMaterialSelection = (partnerId: string) => {
        if (selectedMaterials.includes(partnerId)) {
            setSelectedMaterials(prev => prev.filter(id => id !== partnerId));
        } else {
            setSelectedMaterials(prev => [...prev, partnerId]);
        }
    };

    const handleQuickSelect = () => {
        const available = player.partners.filter(p => p.rarity === synthRarity && !p.isDeployed && !player.buildings.some(b => b.assignedPartners?.includes(p.id)));

        if (available.length < 4) {
            alert('符合條件的素材數量不足 4 張');
            return;
        }

        const countToSelect = Math.floor(available.length / 4) * 4;
        const toSelect = available.slice(0, countToSelect).map(p => p.id);
        setSelectedMaterials(toSelect);
    };

    const handleSynthesis = () => {
        if (selectedMaterials.length < 4) return;
        const synthCount = Math.floor(selectedMaterials.length / 4);

        setSynthAnim(true);
        setSynthResults(null);
        setSynthSuccessCount(0);
        setSynthResults(null);
        setSynthSuccessCount(0);

        setTimeout(async () => {
            const { data, error } = await supabase.rpc('secure_synthesis', {
                p_material_ids: selectedMaterials.slice(0, synthCount * 4)
            });

            if (error) {
                alert('合成失敗: ' + error.message);
                setSynthAnim(false);
                return;
            }

            if (data && data.updated_profile) {
                onUpdatePlayer(mapServerProfile(data.updated_profile));
                setSynthResults(data.results || []);
                setSynthSuccessCount(data.success_count || 0);
            } else {
                // Fallback if updated_profile is not returned, but results might be
                setSynthResults(data.results || []);
                setSynthSuccessCount(data.success_count || 0);
            }
            setSynthAnim(false);
            setSelectedMaterials([]);
        }, 2000);
    };

    const drawGod = () => {
        if (player.incense < 100) { alert('香火不足！招募神明需要 100 香火'); return; }
        setGodDrawLoading(true); setDrawGodResult(null);

        setTimeout(async () => {
            const { data, error } = await supabase.rpc('secure_draw_god');

            if (error) {
                console.error('Draw god error:', error);
                setGodDrawLoading(false);
                return;
            }

            if (data && data.updated_profile) {
                onUpdatePlayer(mapServerProfile(data.updated_profile));
                setDrawGodResult(data.god);
            }
            setGodDrawLoading(false);
        }, 3000);
    };

    const upgradeGod = (godId: string) => {
        const god = player.gods.find(g => g.id === godId);
        if (!god) return;

        const cost = Math.floor(Math.pow(god.level, 1.8) * 1000);
        if (player.incense < cost) {
            alert(`香火不足！升級需要 ${cost} 香火`);
            return;
        }

        onUpdatePlayer(prev => {
            const nextGods = prev.gods.map(g =>
                g.id === godId ? { ...g, level: g.level + 1 } : g
            );
            const nextState = {
                ...prev,
                incense: prev.incense - cost,
                gods: nextGods
            };
            saveProfile(nextState);
            return nextState;
        });
    };

    const toggleGod = (godId: string) => {
        if (isCombatAction) {
            alert('戰鬥中無法變更神明降臨！');
            return;
        }
        onUpdatePlayer(prev => {
            const nextId = prev.activeGodId === godId ? null : godId;
            const nextState = { ...prev, activeGodId: nextId };
            saveProfile(nextState);
            return nextState;
        });
    };


    const gacha = () => {
        if (player.gold < 100) { alert('金幣不足！需要 100 金幣'); return; }
        setAnim(true); setDrawn(null);

        setTimeout(async () => {
            const { data, error } = await supabase.rpc('secure_gacha', { p_count: 1 });
            if (error) {
                console.error('Gacha error:', error);
                setAnim(false);
                return;
            }

            if (data && data.updated_profile) {
                onUpdatePlayer(mapServerProfile(data.updated_profile));
                setDrawn(data.results || []);
            }
            setAnim(false);
        }, 1500);
    };

    const gachaTen = () => {
        if (player.gold < 1000) { alert('金幣不足！需要 1000 金幣'); return; }
        setAnim(true); setDrawn(null);

        setTimeout(async () => {
            const { data, error } = await supabase.rpc('secure_gacha', { p_count: 10 });
            if (error) {
                console.error('Gacha x10 error:', error);
                setAnim(false);
                return;
            }

            if (data && data.updated_profile) {
                onUpdatePlayer(mapServerProfile(data.updated_profile));
                setDrawn(data.results || []);
            }
            setAnim(false);
        }, 2000);
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
        const assignedIdsInFacilities = new Set(player.buildings.flatMap(b => b.assignedPartners || []));
        const groups: Record<string, { base: any, count: number, deployedIds: string[], facilityIds: string[], idleIds: string[] }> = {};
        player.partners.forEach(p => {
            const latestAvatar = getLatestAvatar(p.name, p.avatar);
            if (!groups[p.name]) {
                groups[p.name] = { base: { ...p, avatar: latestAvatar }, count: 0, deployedIds: [], facilityIds: [], idleIds: [] };
            }
            groups[p.name].count++;
            if (p.isDeployed) groups[p.name].deployedIds.push(p.id);
            else if (assignedIdsInFacilities.has(p.id)) groups[p.name].facilityIds.push(p.id);
            else groups[p.name].idleIds.push(p.id);
        });
        return Object.values(groups).sort((a, b) => b.base.rarity - a.base.rarity);
    }, [player.partners, player.buildings]);

    const currentDeployed = player.partners.filter(p => p.isDeployed);

    return (
        <div className="h-full w-full overflow-hidden bg-black/40 relative flex flex-col">
            {/* Header with Title and Gacha Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 lg:p-6 pb-4 border-b border-white/5 shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Users size={28} className="text-game-accent" />
                        夥伴管理中心
                    </h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                        配置你的最強五人小隊
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={openSynthesisModal}
                        className="bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-black py-2.5 px-6 rounded-2xl transition-all active:scale-95 shadow-[0_4px_15px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2 group"
                    >
                        <Zap size={18} className="group-hover:scale-110 transition-transform" />
                        <span>夥伴合成</span>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black py-2.5 px-6 rounded-2xl transition-all active:scale-95 shadow-[0_4px_15px_rgba(251,191,36,0.3)] flex items-center justify-center gap-2 group"
                    >
                        <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                        <span>招募夥伴</span>
                    </button>
                    <button
                        onClick={() => setIsSanctuaryOpen(true)}
                        className="bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-black py-2.5 px-6 rounded-2xl transition-all active:scale-95 shadow-[0_4px_15px_rgba(225,29,72,0.3)] flex items-center justify-center gap-2 group"
                    >
                        <Flame size={18} className="group-hover:scale-110 transition-transform" />
                        <span>神明聖所</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                {/* Left Side (Desktop) / Top Side (Mobile): Current Formation */}
                <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 p-4 lg:p-6 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-white/5 bg-black/20 flex flex-col gap-4">
                    <div className="flex items-center justify-between shrink-0 mb-1 lg:mb-2">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-gray-200 uppercase tracking-wider">出陣陣容</h3>
                            <span className="text-xs font-bold text-game-accent bg-game-accent/10 px-2.5 py-1 rounded-full border border-game-accent/20">
                                {currentDeployed.length} / 5
                            </span>
                        </div>
                        {isCombatAction && (
                            <div className="text-[11px] text-red-400 font-black flex items-center gap-1.5 animate-pulse bg-red-400/10 px-2 py-1 rounded-full border border-red-400/20">
                                <ShieldAlert size={12} /> 鎖定
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-5 lg:grid-cols-1 gap-2 lg:gap-3 shrink-0">
                        {[0, 1, 2, 3, 4].map(idx => {
                            const p = currentDeployed[idx];
                            return (
                                <div key={idx} className={`rounded-xl lg:rounded-[20px] border-2 flex flex-col lg:flex-row items-center justify-center lg:justify-start p-2 lg:p-3 transition-all relative group ${p ? `${RARITY_COLORS[p.rarity].border} ${RARITY_COLORS[p.rarity].bg} ${RARITY_COLORS[p.rarity].glow}` : 'border-dashed border-white/10 bg-black/20 text-gray-700'}`}>
                                    {p ? (
                                        <>
                                            <button
                                                disabled={isCombatAction}
                                                onClick={() => toggleDeploy(p.id)}
                                                className="absolute -top-1.5 -right-1.5 lg:-top-2 lg:-right-2 w-5 h-5 lg:w-7 lg:h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform hover:bg-red-400 disabled:hidden z-10"
                                            >
                                                <MinusCircle size={14} className="lg:w-[18px] lg:h-[18px]" />
                                            </button>

                                            <div className="text-2xl lg:text-4xl lg:mr-3.5 shrink-0 flex items-center justify-center w-8 h-8 lg:w-[50px] lg:h-[50px] bg-black/30 rounded-lg lg:rounded-xl shadow-inner border border-white/5">{getLatestAvatar(p.name, p.avatar)}</div>

                                            <div className="flex-1 min-w-0 flex flex-col items-center lg:items-start w-full mt-1.5 lg:mt-0">
                                                <div className="hidden lg:flex items-center justify-between w-full mb-1">
                                                    <span className="font-black text-[15px] text-white truncate drop-shadow-md">{p.name}</span>
                                                    <span className="text-[10px] font-black text-white/60 uppercase shrink-0 bg-black/50 px-1.5 py-0.5 rounded border border-white/5">LV.{p.level}</span>
                                                </div>
                                                <div className="lg:hidden font-black text-[9px] text-white truncate w-full text-center leading-tight">{p.name}</div>

                                                <div className="hidden lg:flex items-center gap-2.5 w-full">
                                                    <Stars n={p.rarity} />
                                                    <RoleTag role={p.role} />
                                                </div>
                                                <div className="lg:hidden mt-0.5 flex justify-center scale-[0.6] origin-top h-2">
                                                    <Stars n={p.rarity} />
                                                </div>

                                                {/* EXP Bar */}
                                                <div className="w-full mt-1.5 opacity-80">
                                                    <div className="h-1 bg-black/50 rounded-full overflow-hidden border border-white/5">
                                                        <div className="h-full bg-game-gold transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, (p.exp / p.maxExp) * 100))}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3.5 opacity-50 w-full lg:px-2 py-0.5 lg:py-1">
                                            <div className="w-8 h-8 lg:w-[50px] lg:h-[50px] rounded-lg lg:rounded-xl border-2 border-current flex items-center justify-center text-sm lg:text-2xl font-black shrink-0">?</div>
                                            <div className="text-[9px] lg:text-xs font-black uppercase tracking-widest text-center lg:text-left">待命位<br /><span className="hidden lg:inline text-[10px] opacity-70 font-normal tracking-normal normal-case">點選右側清單上陣</span></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Side (Desktop) / Bottom Side (Mobile): All Partners */}
                <div className="flex-1 p-4 lg:p-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4 max-w-[1400px] mx-auto">
                        <h3 className="text-lg font-black text-gray-200 border-l-4 border-white/20 pl-4 uppercase tracking-wider mb-2">持有清單</h3>
                        {groupedPartners.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center glass-panel rounded-3xl border border-dashed border-white/10 opacity-50">
                                <Users size={48} className="mb-4" />
                                <p className="font-bold">尚未獲得任何勇者夥伴</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {groupedPartners.map((group) => (
                                    <div key={group.base.name} className={`p-4 rounded-3xl border-2 flex items-center gap-4 transition-all group ${RARITY_COLORS[group.base.rarity].border} ${RARITY_COLORS[group.base.rarity].bg} ${RARITY_COLORS[group.base.rarity].glow} ${group.idleIds.length === 0 && (group.deployedIds.length > 0 || group.facilityIds.length > 0) ? 'opacity-80' : 'hover:brightness-125 hover:scale-[1.02]'}`}>
                                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-3xl border-2 border-white/10 shadow-inner group-hover:scale-105 transition-transform`}>
                                                {group.base.avatar}
                                            </div>
                                            <div className="text-[10px] font-black text-gray-400 whitespace-nowrap">
                                                Lv.{group.base.level} <span className="text-[8px] opacity-60">({Math.floor((group.base.exp / group.base.maxExp) * 100)}%)</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div className="w-full">
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-black text-white flex items-center gap-1.5 truncate">
                                                            {group.base.name}
                                                            <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded font-mono">
                                                                x{group.idleIds.length}
                                                                {group.count > group.idleIds.length && (
                                                                    <span className="text-[9px] opacity-40 ml-1">/ 總計 {group.count}</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Stars n={group.base.rarity} />
                                                        <span className="text-[10px] font-black text-game-accent uppercase whitespace-nowrap">戰鬥力 {group.base.power}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <RoleTag role={group.base.role} />
                                                {group.facilityIds.length > 0 && (
                                                    <div className="text-[9px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1 whitespace-nowrap">
                                                        <Home size={10} /> {group.facilityIds.length} 設施中
                                                    </div>
                                                )}
                                                {group.deployedIds.length > 0 && (
                                                    <div className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1 whitespace-nowrap">
                                                        <CheckCircle2 size={10} /> {group.deployedIds.length} 上陣
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5 min-w-[70px]">

                                            {group.idleIds.length > 0 && (
                                                <button
                                                    disabled={isCombatAction || currentDeployed.length >= 5}
                                                    onClick={() => toggleDeploy(group.idleIds[0])}
                                                    className="w-full py-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl text-[10px] font-black transition-all border border-emerald-500/30 disabled:opacity-30 flex items-center justify-center gap-1"
                                                >
                                                    <PlusCircle size={12} /> 上陣
                                                </button>
                                            )}
                                            {group.deployedIds.length > 0 && (
                                                <button
                                                    disabled={isCombatAction}
                                                    onClick={() => toggleDeploy(group.deployedIds[0])}
                                                    className="w-full py-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-[10px] font-black transition-all border border-red-500/30 flex items-center justify-center gap-1"
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

                {/* GACHA MODAL */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in">
                        <div className={`glass-panel w-full ${drawn && drawn.length > 1 ? 'max-w-5xl' : 'max-w-sm md:max-w-3xl'} max-h-[90vh] md:max-h-[80vh] overflow-hidden rounded-[40px] p-6 md:p-8 border-2 border-amber-500/30 shadow-2xl relative flex flex-col md:flex-row text-center md:text-left bg-gradient-to-b md:bg-gradient-to-r from-amber-500/10 to-transparent transition-all duration-500`}>
                            <div className="absolute inset-0 anim-shimmer pointer-events-none opacity-30" />

                            <button
                                onClick={() => { setIsModalOpen(false); setDrawn(null); }}
                                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white z-10"
                            >
                                <X size={24} />
                            </button>

                            {/* Left Side: Info & Button */}
                            <div className="flex-1 flex flex-col items-center md:border-r border-white/10 md:pr-8">
                                <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center mb-5 border-2 border-amber-500/40 mt-4 mx-auto">
                                    <Sparkles size={48} className="text-game-gold anim-float" />
                                </div>

                                <h3 className="text-3xl font-black text-white mb-2 italic text-center">命運契約</h3>
                                <p className="text-sm text-gray-400 mb-8 leading-relaxed text-center">呼喚隱眠於異界的靈魂<br />以金幣之力訂立命運之盟</p>

                                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[280px] sm:max-w-none justify-center mx-auto md:mx-0 mb-8">
                                    <button
                                        onClick={gacha}
                                        disabled={anim}
                                        className="group flex-1 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black py-4 px-4 rounded-3xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_8px_30px_rgba(251,191,36,0.3)] flex flex-col items-center gap-0.5"
                                    >
                                        {anim ? (
                                            <><Loader2 className="animate-spin mb-1" /> <span className="text-sm">共鳴中</span></>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5">
                                                    <UserPlus size={18} />
                                                    <span className="text-base">單次招募</span>
                                                </div>
                                                <div className="text-[10px] opacity-70 mt-1">100 金幣</div>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={gachaTen}
                                        disabled={anim}
                                        className="group flex-1 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black py-4 px-4 rounded-3xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_8px_30px_rgba(234,88,12,0.4)] flex flex-col items-center gap-0.5 relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                                        {anim ? (
                                            <><Loader2 className="animate-spin mb-1" /> <span className="text-sm">大量共鳴中</span></>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5">
                                                    <Users size={18} />
                                                    <span className="text-base">十連招募</span>
                                                </div>
                                                <div className="text-[10px] opacity-90 mt-1 text-orange-200">1000 金幣</div>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="mt-auto pt-6 border-t border-white/5 w-full hidden md:block">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2">
                                        <ShieldAlert size={14} className="text-amber-500" /> 招募法則
                                    </h4>
                                    <div className="grid grid-cols-3 gap-0">
                                        <div className="flex flex-col items-center">
                                            <span className="text-game-gold font-black text-sm">1%</span>
                                            <span className="text-[11px] text-gray-500 font-bold">傳奇 5★</span>
                                        </div>
                                        <div className="flex flex-col items-center border-x border-white/5">
                                            <span className="text-purple-400 font-black text-sm">10%</span>
                                            <span className="text-[11px] text-gray-500 font-bold">史詩 4★</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-sky-400 font-black text-sm">89%</span>
                                            <span className="text-[11px] text-gray-500 font-bold">精英 3★</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Result */}
                            <div className="flex-1 flex flex-col items-center justify-center md:pl-8 mt-8 md:mt-0 min-h-[300px] w-full">
                                {drawn && !anim ? (
                                    drawn.length === 1 ? (
                                        <div className={`p-6 rounded-[32px] border-2 w-full max-w-[280px] animate-in zoom-in-95 duration-300 relative bg-black/40 shadow-2xl ${RARITY_COLORS[drawn[0].rarity!].border} ${RARITY_COLORS[drawn[0].rarity!].glow}`}>
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black px-4 py-1.5 rounded-full border border-white/20 text-[10px] font-black text-game-gold whitespace-nowrap tracking-widest shadow-md">NEW PARTNER</div>
                                            <div className="text-6xl mb-4 transform hover:scale-110 transition-transform flex justify-center drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{getLatestAvatar(drawn[0].name, drawn[0].avatar)}</div>
                                            <div className="flex justify-center mb-3"><Stars n={drawn[0].rarity!} /></div>
                                            <div className="font-black text-xl text-white mb-2 text-center tracking-wide">{drawn[0].name}</div>
                                            <div className="flex flex-col items-center gap-3">
                                                <RoleTag role={drawn[0].role} />
                                                <div className="text-xs font-mono text-gray-300 bg-black/40 px-3 py-1 rounded-xl border border-white/5">戰鬥力: {drawn[0].power}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full">
                                            <div className="absolute top-4 right-4 bg-black/60 px-4 py-1.5 rounded-full border border-amber-500/30 text-xs font-black text-amber-500 whitespace-nowrap tracking-widest shadow-lg animate-pulse z-10 hidden md:block">10 PULLS</div>
                                            <div className={`grid ${drawn.length > 5 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'} gap-2 sm:gap-4 md:gap-5 max-h-[65vh] md:max-h-[60vh] overflow-y-auto custom-scrollbar p-1 md:p-4`}>
                                                {drawn.map((p, i) => (
                                                    <div
                                                        key={p.id}
                                                        className={`p-3 sm:p-5 rounded-2xl sm:rounded-[24px] border-2 flex flex-col items-center justify-center relative bg-black/40 hover:bg-black/60 transition-all ${RARITY_COLORS[p.rarity!].border} ${RARITY_COLORS[p.rarity!].glow} animate-in zoom-in fill-mode-both shadow-lg`}
                                                        style={{ animationDelay: `${i * 100}ms` }}
                                                    >
                                                        {p.rarity! >= 4 && (
                                                            <div className="absolute inset-0 bg-white/5 rounded-2xl sm:rounded-[24px] pointer-events-none animate-pulse" />
                                                        )}
                                                        {p.rarity! === 5 && (
                                                            <div className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-black text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg transform rotate-12 animate-bounce z-10">SSR</div>
                                                        )}
                                                        <div className={`text-3xl sm:text-5xl mb-2 sm:mb-3 transform hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] ${p.rarity! >= 4 ? 'animate-bounce' : ''}`}>{getLatestAvatar(p.name, p.avatar)}</div>
                                                        <div className="flex justify-center mb-1.5 h-3 scale-75 sm:scale-100"><Stars n={p.rarity!} /></div>
                                                        <div className="font-black text-[10px] sm:text-sm text-white text-center w-full leading-tight drop-shadow-sm truncate px-1">{p.name}</div>
                                                        <div className="mt-1.5 text-[8px] sm:text-[9px] font-bold text-gray-400 bg-black/30 px-1.5 py-0.5 rounded-full border border-white/5 uppercase opacity-80">ATK {p.power}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                ) : anim ? (
                                    <div className="text-amber-500/50 flex flex-col items-center justify-center animate-pulse">
                                        <Sparkles size={64} className="mb-4" />
                                        <div className="font-black text-xl tracking-widest">SUMMONING...</div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full border-2 border-dashed border-white/10 rounded-[32px] flex items-center justify-center opacity-30 text-center flex-col p-6 min-h-[250px] mx-auto max-w-[280px]">
                                        <UserPlus size={48} className="mb-4" />
                                        <p className="font-bold">等待召喚...</p>
                                    </div>
                                )}
                            </div>

                            {/* Mobile rules at bottom */}
                            <div className="mt-8 pt-6 border-t border-white/5 w-full md:hidden">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2">
                                    <ShieldAlert size={14} className="text-amber-500" /> 招募法則
                                </h4>
                                <div className="grid grid-cols-3 gap-0">
                                    <div className="flex flex-col items-center">
                                        <span className="text-game-gold font-black text-sm">1%</span>
                                        <span className="text-[11px] text-gray-500 font-bold">傳奇 5★</span>
                                    </div>
                                    <div className="flex flex-col items-center border-x border-white/5">
                                        <span className="text-purple-400 font-black text-sm">10%</span>
                                        <span className="text-[11px] text-gray-500 font-bold">史詩 4★</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-sky-400 font-black text-sm">89%</span>
                                        <span className="text-[11px] text-gray-500 font-bold">精英 3★</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SYNTHESIS MODAL */}
                {isSynthesisModalOpen && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in">
                        <div className="glass-panel w-full max-w-sm md:max-w-4xl xl:max-w-5xl max-h-[80vh] rounded-[40px] p-6 lg:p-8 border-2 border-purple-500/30 shadow-2xl relative flex flex-col md:flex-row gap-6 bg-gradient-to-b md:bg-gradient-to-r from-purple-900/40 to-black overflow-hidden">

                            <button
                                onClick={() => setIsSynthesisModalOpen(false)}
                                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white z-20"
                            >
                                <X size={20} />
                            </button>

                            {/* Left Side: Info & Actions */}
                            <div className="flex flex-col md:w-64 shrink-0 h-full">
                                <div className="flex items-center gap-3 mb-6 shrink-0 md:justify-start justify-center">
                                    <Zap size={24} className="text-purple-400" />
                                    <h3 className="text-xl font-black text-white">夥伴合成</h3>
                                </div>

                                {!synthResults && !synthAnim && (
                                    <div className="flex md:flex-col justify-center gap-4 mb-6 shrink-0">
                                        <button
                                            onClick={() => { setSynthRarity(3); setSelectedMaterials([]); }}
                                            className={`px-6 py-3 rounded-xl font-black transition-all ${synthRarity === 3 ? 'bg-sky-500/20 text-sky-400 border-2 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'bg-white/5 text-gray-400 border-2 border-transparent hover:bg-white/10'}`}
                                        >
                                            3★ 升 4★
                                        </button>
                                        <button
                                            onClick={() => { setSynthRarity(4); setSelectedMaterials([]); }}
                                            className={`px-6 py-3 rounded-xl font-black transition-all ${synthRarity === 4 ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-gray-400 border-2 border-transparent hover:bg-white/10'}`}
                                        >
                                            4★ 升 5★
                                        </button>
                                    </div>
                                )}

                                {!synthResults && !synthAnim && (
                                    <div className="mt-auto shrink-0 hidden md:flex flex-col gap-4">
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                            <h5 className="text-red-400 font-black text-sm flex items-center gap-1.5 mb-1.5"><AlertTriangle size={15} /> 警告</h5>
                                            <p className="text-[11px] text-red-400/80 leading-relaxed font-bold">
                                                合成材料將會<span className="text-red-300">永久消失</span>，且不保證 100% 成功。
                                            </p>
                                        </div>

                                        <div className="text-xs text-gray-400 font-bold bg-white/5 p-3 rounded-xl">
                                            <div>機率: {synthRarity === 3 ? '10% 獲取 4★' : '5% 獲取 5★'}</div>
                                            <div className="opacity-60 font-medium text-[10px] mt-1">(失敗則隨機退還 1 張同星級)</div>
                                        </div>

                                        <button
                                            onClick={handleSynthesis}
                                            disabled={selectedMaterials.length < 4}
                                            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-white/5 disabled:text-gray-500 text-white font-black py-4 px-8 rounded-xl transition-all shadow-[0_4px_15px_rgba(168,85,247,0.3)] disabled:shadow-none"
                                        >
                                            確認合成 ({Math.floor(selectedMaterials.length / 4)} 次)
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Right Side: Materials Array */}
                            <div className="flex-1 overflow-y-auto min-h-[300px] custom-scrollbar rounded-2xl bg-black/40 p-4 border border-white/5 relative">
                                {synthAnim ? (
                                    <div className="h-full flex flex-col items-center justify-center">
                                        <Loader2 size={48} className="animate-spin text-purple-500 mb-4" />
                                        <p className="text-lg font-black text-purple-400 animate-pulse">靈魂融合中...</p>
                                    </div>
                                ) : synthResults ? (
                                    <div className="h-full flex flex-col items-center animate-in zoom-in-95 duration-500 w-full overflow-y-auto custom-scrollbar p-2">
                                        <div className="text-center mb-6">
                                            <h4 className={`text-2xl font-black flex items-center justify-center gap-2 ${synthSuccessCount > 0 ? 'text-game-gold' : 'text-gray-400'}`}>
                                                {synthSuccessCount > 0 ? <><Sparkles /> 合成完畢！成功 {synthSuccessCount} 次</> : '合成完畢，全數失敗...'}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">失敗之次數已自動退還同星級隨機夥伴</p>
                                        </div>

                                        <div className={`grid ${synthResults.length > 1 ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'} gap-4 w-full`}>
                                            {synthResults.map((p, i) => (
                                                <div
                                                    key={p.id}
                                                    className={`p-4 rounded-[24px] border-2 flex flex-col items-center relative transition-all animate-in zoom-in fill-mode-both ${RARITY_COLORS[p.rarity].border} ${RARITY_COLORS[p.rarity].bg} ${RARITY_COLORS[p.rarity].glow}`}
                                                    style={{ animationDelay: `${i * 100}ms` }}
                                                >
                                                    {p.rarity > synthRarity && (
                                                        <div className="absolute -top-2 -left-2 bg-game-gold text-black text-[10px] font-black px-2 py-0.5 rounded shadow-lg transform -rotate-12 z-10 animate-bounce">SUCCESS</div>
                                                    )}
                                                    <div className="text-4xl mb-2 transform hover:scale-110 transition-transform">{p.avatar}</div>
                                                    <div className="flex justify-center mb-2 scale-75 origin-top h-2"><Stars n={p.rarity} /></div>
                                                    <div className="font-black text-xs text-white mb-1 truncate w-full text-center">{p.name}</div>
                                                    <RoleTag role={p.role} />
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => { setSynthResults(null); setSynthSuccessCount(0); }}
                                            className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl transition-all shrink-0"
                                        >
                                            返回介面
                                        </button>
                                    </div>
                                ) : (() => {
                                    const theme = synthRarity === 3 ? {
                                        btn: "bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border-sky-500/40",
                                        badge: "bg-sky-500/20 text-sky-300 border-sky-500/30",
                                        cardSelected: "border-sky-500 bg-sky-500/20 scale-95 shadow-[0_0_15px_rgba(14,165,233,0.4)]",
                                        cardHover: "hover:border-sky-500/30",
                                        checkBg: "bg-sky-500",
                                        confirmBtn: "bg-sky-600 hover:bg-sky-500 shadow-[0_4px_15px_rgba(14,165,233,0.3)]"
                                    } : {
                                        btn: "bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-purple-500/40",
                                        badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                                        cardSelected: "border-purple-500 bg-purple-500/20 scale-95 shadow-[0_0_15px_rgba(168,85,247,0.4)]",
                                        cardHover: "hover:border-purple-500/30",
                                        checkBg: "bg-purple-500",
                                        confirmBtn: "bg-purple-600 hover:bg-purple-500 shadow-[0_4px_15px_rgba(168,85,247,0.3)]"
                                    };
                                    return (
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-4 sticky top-0 bg-black/40 p-2 z-10 backdrop-blur-md rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-gray-400 hidden sm:block">請選擇 4 張同星級卡片做為材料</p>
                                                    <p className="text-sm font-bold text-gray-400 sm:hidden">選 4 張素材</p>
                                                    <button
                                                        onClick={handleQuickSelect}
                                                        className={`ml-2 font-black text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 active:scale-95 ${theme.btn}`}
                                                        title="一次選取 4 的倍數張閒置夥伴"
                                                    >
                                                        <Zap size={14} className="text-amber-400" /> 一鍵全選
                                                    </button>
                                                </div>
                                                <span className={`text-xs px-3 py-1 rounded-full font-mono border shrink-0 ${theme.badge}`}>已選: {selectedMaterials.length} ({Math.floor(selectedMaterials.length / 4)} 次)</span>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                                {player.partners
                                                    .filter(p => p.rarity === synthRarity && !p.isDeployed && !player.buildings.some(b => b.assignedPartners?.includes(p.id)))
                                                    .map(p => {
                                                        const isSelected = selectedMaterials.includes(p.id);
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => toggleMaterialSelection(p.id)}
                                                                className={`rounded-2xl border flex flex-col items-center justify-center p-2 cursor-pointer transition-all relative
                                                            ${isSelected ? theme.cardSelected : `border-white/5 bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100 ${theme.cardHover}`}
                                                        `}
                                                            >
                                                                {isSelected && (
                                                                    <div className={`absolute top-1 right-1 text-white rounded-full p-0.5 z-10 shadow-lg scale-75 ${theme.checkBg}`}>
                                                                        <CheckCircle2 size={16} />
                                                                    </div>
                                                                )}
                                                                <div className="text-3xl mb-1 mt-1 group-hover:scale-110 transition-transform">{getLatestAvatar(p.name, p.avatar)}</div>
                                                                <div className="font-black text-[10px] text-center truncate w-full px-1 text-white/90">{p.name}</div>
                                                                <div className="mt-1 flex items-center gap-0.5 bg-black/30 px-1.5 py-0.5 rounded-full border border-white/5">
                                                                    <Star size={8} className="text-game-gold" fill="currentColor" />
                                                                    <span className="text-[9px] font-black text-game-gold">{p.rarity}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                }
                                                {player.partners.filter(p => p.rarity === synthRarity && !p.isDeployed && !player.buildings.some(b => b.assignedPartners?.includes(p.id))).length === 0 && (
                                                    <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-50">
                                                        <Users size={32} className="mb-2" />
                                                        <p className="font-bold text-sm">沒有符合條件的未上陣夥伴</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Mobile actions at bottom */}
                            {!synthResults && !synthAnim && (
                                <div className="mt-6 shrink-0 md:hidden flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-xs text-gray-400 font-bold text-center sm:text-left">
                                            合成預覽: {synthRarity}★ <ArrowRight size={10} className="inline opacity-50 mx-1" /> {synthRarity === 3 ? '10% 獲取 4★' : '5% 獲取 5★'}<br />
                                        </div>
                                        <button
                                            onClick={handleSynthesis}
                                            disabled={selectedMaterials.length < 4}
                                            className={`w-full sm:w-auto disabled:bg-white/5 disabled:text-gray-500 text-white font-black py-4 px-8 rounded-xl transition-all disabled:shadow-none ${synthRarity === 3 ? 'bg-sky-600 hover:bg-sky-500 shadow-[0_4px_15px_rgba(14,165,233,0.3)]' : 'bg-purple-600 hover:bg-purple-500 shadow-[0_4px_15px_rgba(168,85,247,0.3)]'}`}
                                        >
                                            確認合成 ({Math.floor(selectedMaterials.length / 4)} 次)
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}

                {/* GOD SANCTUARY MODAL */}
                {isSanctuaryOpen && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-xl anim-fade-in">
                        <div className="relative w-full max-w-5xl h-[95vh] sm:h-[90vh] md:h-[80vh] flex flex-col glass-panel rounded-3xl sm:rounded-[40px] border-2 border-red-500/20 shadow-2xl overflow-hidden anim-scale-in bg-gradient-to-br from-red-950/30 to-black">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/5 bg-red-950/20">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-red-500/20 flex items-center justify-center text-red-400 border border-red-500/30 shadow-lg shrink-0">
                                        <Flame size={20} className="sm:w-7 sm:h-7 anim-float" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg sm:text-2xl font-black text-white italic tracking-widest truncate">神明聖所 <span className="hidden sm:inline text-xs font-bold text-red-500 not-italic ml-2 tracking-normal uppercase border border-red-500/30 px-2 py-0.5 rounded-full">Divine Sanctuary</span></h2>
                                        <p className="text-[10px] sm:text-xs text-gray-400 font-black mt-0.5 sm:mt-1 uppercase tracking-widest flex items-center gap-2 truncate">
                                            <Diamond size={10} className="text-red-400 shrink-0" /> <span className="truncate">呼喚守護之靈，祈求全境庇佑</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2 bg-black/40 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/5">
                                        <Flame size={14} className="text-red-400" />
                                        <span className="text-sm sm:text-lg font-black text-white tabular-nums">{player.incense}</span>
                                    </div>
                                    <button onClick={() => setIsSanctuaryOpen(false)} className="p-1.5 rounded-full hover:bg-white/5 transition-colors text-gray-500 hover:text-white shrink-0">
                                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                                {/* Left: Divine Invocation */}
                                <div className="w-full md:w-72 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center bg-red-950/10 shrink-0">
                                    <div className="relative mb-6 sm:mb-8 group">
                                        <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl group-hover:bg-red-500/40 transition-all duration-500 anim-god-aura" />
                                        <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-red-600/20 to-rose-600/20 flex items-center justify-center border-4 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.2)] relative z-10 transition-transform ${godDrawLoading ? 'scale-90 rotate-180' : 'group-hover:scale-110'}`}>
                                            {godDrawLoading ? <Loader2 size={36} className="sm:w-12 sm:h-12 animate-spin text-red-400" /> : <Flame size={48} className="sm:w-16 sm:h-16 text-red-400" />}
                                        </div>
                                    </div>

                                    <h3 className="text-lg sm:text-xl font-black text-white mb-1 sm:mb-2 italic">焚香請願</h3>
                                    <p className="text-[10px] sm:text-xs text-gray-400 text-center mb-4 sm:mb-6 leading-relaxed font-bold">
                                        消耗 100 香火進行請願<br />
                                        <span className="text-red-400">誠心期盼神明降臨</span>
                                    </p>

                                    {/* God Probability Display */}
                                    <div className="w-full bg-black/40 rounded-2xl p-4 border border-white/5 mb-6 sm:mb-8">
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                                            <ShieldAlert size={12} className="text-red-400" /> 出現機率
                                        </h4>
                                        <div className="flex justify-around items-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-red-400 font-black text-base">2.0%</span>
                                                <span className="text-[9px] text-gray-500 font-bold">神明降臨</span>
                                            </div>
                                            <div className="w-[1px] h-8 bg-white/5" />
                                            <div className="flex flex-col items-center">
                                                <span className="text-gray-400 font-black text-base">98.0%</span>
                                                <span className="text-[9px] text-gray-500 font-bold">緣分未到</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={drawGod}
                                        disabled={godDrawLoading || player.incense < 100}
                                        className="w-full py-3 sm:py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:grayscale mb-4 flex items-center justify-center gap-2 group relative overflow-hidden text-sm sm:text-base"
                                    >
                                        {godDrawLoading ? '儀式進行中...' : <><Sparkles size={16} /> 開始招募</>}
                                    </button>

                                    {drawGodResult && (
                                        <div className="mt-2 text-[11px] text-gray-600 font-bold border border-white/5 p-3 rounded-xl bg-black/20 italic">
                                            "信仰本無蹤，唯心誠則靈"
                                        </div>
                                    )}
                                </div>

                                {/* Right: Owned Gods Grid */}
                                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                                    <div className="mb-6 flex items-center justify-between">
                                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                                            <Users size={20} className="text-red-400" />
                                            目前降臨的神明 <span className="text-xs font-mono text-gray-500">({player.gods.length})</span>
                                        </h3>
                                        <div className="text-[10px] font-bold text-red-400/70 border border-red-400/20 px-3 py-1 rounded-full uppercase tracking-widest">
                                            只能選擇一位神明守護
                                        </div>
                                    </div>

                                    {player.gods.length === 0 ? (
                                        <div className="h-64 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-white/5 rounded-3xl">
                                            <Search size={48} className="mb-4" />
                                            <p className="font-bold">聖所目下尚無神明降臨</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-24 md:pb-0">
                                            {player.gods.map(god => {
                                                const isActive = player.activeGodId === god.id;
                                                const upgradeCost = Math.floor(Math.pow(god.level, 1.8) * 1000);
                                                return (
                                                    <div key={god.id} className={`p-4 sm:p-5 rounded-[24px] sm:rounded-[32px] border-2 transition-all relative group overflow-hidden ${isActive ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.25)]' : 'bg-black/30 border-white/5 hover:border-white/20'}`}>
                                                        {isActive && <div className="absolute top-0 right-0 bg-amber-400 text-game-dark text-[8px] sm:text-[10px] font-black px-3 sm:px-4 py-1 rounded-bl-xl shadow-lg anim-pulse-glow z-10">守護中</div>}

                                                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start relative z-10">
                                                            <div className="flex flex-row sm:flex-col items-center gap-3 shrink-0">
                                                                <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-3xl bg-gradient-to-br from-slate-900 to-black flex items-center justify-center text-3xl sm:text-4xl border-2 transition-transform duration-500 ${isActive ? 'border-amber-400/50 scale-105 anim-god-glow' : 'border-white/10 group-hover:scale-105'}`}>
                                                                    {god.avatar}
                                                                </div>
                                                                <div className="bg-black/60 px-3 py-1 rounded-full border border-white/10 text-[10px] sm:text-xs font-black text-white tracking-widest whitespace-nowrap">Lv.{god.level}</div>
                                                            </div>

                                                            <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                                                                <div className="font-black text-xl text-white mb-1 truncate">{god.name}</div>
                                                                <div className="flex items-start sm:items-center gap-2 mb-3">
                                                                    <span className="text-[9px] sm:text-[10px] font-black uppercase text-red-400 bg-red-400/10 px-1.5 sm:px-2 py-0.5 rounded border border-red-400/20 whitespace-nowrap shrink-0">守護能力</span>
                                                                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 italic leading-snug">{god.description}</p>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                                                    <button
                                                                        onClick={() => toggleGod(god.id)}
                                                                        className={`py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all border ${isActive ? 'bg-amber-400 text-game-dark border-amber-500' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`}
                                                                    >
                                                                        {isActive ? '取消派遣' : '請求派遣'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => upgradeGod(god.id)}
                                                                        className="py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-[10px] sm:text-xs font-black transition-all border border-red-500/30 flex flex-col items-center justify-center gap-0.5"
                                                                    >
                                                                        <span className="leading-none text-[9px] sm:text-xs">供奉升級</span>
                                                                        <span className="text-[8px] sm:text-[9px] opacity-70 font-bold tabular-nums">-{upgradeCost} 🏮</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Aura background fixed behind */}
                                                        {isActive && <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-amber-400/10 rounded-full blur-[60px] pointer-events-none" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer / Tip */}
                            <div className="p-4 bg-red-950/40 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] font-bold text-red-400/60 uppercase tracking-widest">
                                <Info size={14} /> 神明將抵消惡劣天氣對您的各種負面屬性損失
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


