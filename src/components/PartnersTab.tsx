import React, { useState, useMemo } from 'react';
import { Star, Sparkles, UserPlus, Users, ShieldAlert, CheckCircle2, MinusCircle, PlusCircle, Loader2, X, Zap, AlertTriangle, ArrowRight } from 'lucide-react';
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
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Synthesis states
    const [isSynthesisModalOpen, setIsSynthesisModalOpen] = useState(false);
    const [synthRarity, setSynthRarity] = useState<3 | 4>(3);
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
    const [synthAnim, setSynthAnim] = useState(false);
    const [synthResult, setSynthResult] = useState<Partner | null>(null);
    const [synthSuccess, setSynthSuccess] = useState<boolean | null>(null);

    const openSynthesisModal = () => {
        setIsSynthesisModalOpen(true);
        setSynthRarity(3);
        setSelectedMaterials([]);
        setSynthResult(null);
        setSynthSuccess(null);
        setSynthAnim(false);
    };

    const toggleMaterialSelection = (partnerId: string) => {
        if (selectedMaterials.includes(partnerId)) {
            setSelectedMaterials(prev => prev.filter(id => id !== partnerId));
        } else {
            if (selectedMaterials.length < 4) {
                setSelectedMaterials(prev => [...prev, partnerId]);
            }
        }
    };

    const handleSynthesis = () => {
        if (selectedMaterials.length !== 4) return;
        setSynthAnim(true);
        setSynthResult(null);
        setSynthSuccess(null);

        setTimeout(() => {
            const successRate = synthRarity === 3 ? 0.10 : 0.05;
            const isSuccess = Math.random() < successRate;
            const nextRarity = isSuccess ? (synthRarity + 1 as 3 | 4 | 5) : synthRarity;

            const cands = pool.filter(p => p.rarity === nextRarity);
            const s = cands[Math.floor(Math.random() * cands.length)];
            const np: Partner = { id: Math.random().toString(), ...s, level: 1, isDeployed: false };

            setSynthResult(np);
            setSynthSuccess(isSuccess);
            setSynthAnim(false);

            onUpdatePlayer(prev => {
                const nextPartners = prev.partners.filter(p => !selectedMaterials.includes(p.id));
                nextPartners.push(np);
                const nextState = {
                    ...prev,
                    partners: nextPartners
                };
                saveProfile(nextState);
                return nextState;
            });
            setSelectedMaterials([]);
        }, 2000);
    };

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
                                                        <span className="text-[10px] font-black text-game-accent uppercase whitespace-nowrap">戰鬥力 {group.base.power}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <RoleTag role={group.base.role} />
                                                {group.deployedIds.length > 0 && (
                                                    <div className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1 whitespace-nowrap">
                                                        <CheckCircle2 size={10} /> {group.deployedIds.length} 上陣
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

                {/* GACHA MODAL */}
                {isModalOpen && (
                    <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in">
                        <div className="glass-panel w-full max-w-sm rounded-[40px] p-8 border-2 border-amber-500/30 shadow-2xl relative overflow-hidden flex flex-col items-center text-center bg-gradient-to-b from-amber-500/10 to-transparent">
                            <div className="absolute inset-0 anim-shimmer pointer-events-none opacity-30" />

                            <button
                                onClick={() => { setIsModalOpen(false); setDrawn(null); }}
                                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>

                            <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 border-2 border-amber-500/40 mt-4">
                                <Sparkles size={48} className="text-game-gold anim-float" />
                            </div>

                            <h3 className="text-3xl font-black text-white mb-2 italic">魂之招募</h3>
                            <p className="text-sm text-gray-400 mb-8 leading-relaxed">尋找跨越時空的契約者<br />為勇者提供命運加護</p>

                            <button
                                onClick={gacha}
                                disabled={anim}
                                className="group w-full bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black py-4 px-6 rounded-3xl transition-all active:scale-95 disabled:opacity-50 shadow-[0_8px_30px_rgba(251,191,36,0.5)] flex flex-col items-center gap-0.5 mb-8"
                            >
                                {anim ? (
                                    <><Loader2 className="animate-spin mb-1" /> <span className="text-base">共鳴中...</span></>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <UserPlus size={22} />
                                            <span className="text-lg">起始召喚</span>
                                        </div>
                                        <div className="text-xs opacity-70">每次消耗 100 金幣</div>
                                    </>
                                )}
                            </button>

                            {drawn && !anim && (
                                <div className={`p-6 rounded-[32px] border-2 w-full animate-in zoom-in-95 duration-300 relative ${RARITY_COLORS[drawn.rarity!].border} ${RARITY_COLORS[drawn.rarity!].bg} ${RARITY_COLORS[drawn.rarity!].glow}`}>
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black px-4 py-1.5 rounded-full border border-white/20 text-[10px] font-black text-game-gold whitespace-nowrap tracking-widest">NEW PARTNER</div>
                                    <div className="text-6xl mb-4 transform hover:scale-110 transition-transform">{drawn.avatar}</div>
                                    <div className="flex justify-center mb-3"><Stars n={drawn.rarity!} /></div>
                                    <div className="font-black text-xl text-white mb-2">{drawn.name}</div>
                                    <div className="flex flex-col items-center gap-3">
                                        <RoleTag role={drawn.role} />
                                        <div className="text-xs font-mono text-gray-300 bg-black/40 px-3 py-1 rounded-xl border border-white/5">戰鬥力: {drawn.power}</div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-white/5 w-full">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2">
                                    <ShieldAlert size={14} className="text-amber-500" /> 招募法則
                                </h4>
                                <div className="flex justify-around gap-2 px-2">
                                    <div className="flex flex-col items-center">
                                        <span className="text-game-gold font-black text-sm">1%</span>
                                        <span className="text-[11px] text-gray-500 font-bold">傳奇</span>
                                    </div>
                                    <div className="flex flex-col items-center border-x border-white/5 px-4">
                                        <span className="text-gray-300 font-black text-sm">10%</span>
                                        <span className="text-[11px] text-gray-500 font-bold">史詩</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-gray-500 font-black text-sm">89%</span>
                                        <span className="text-[11px] text-gray-500 font-bold">精英</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SYNTHESIS MODAL */}
                {isSynthesisModalOpen && (
                    <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in">
                        <div className="glass-panel w-full max-w-2xl max-h-[90vh] rounded-[40px] p-6 lg:p-8 border-2 border-purple-500/30 shadow-2xl relative flex flex-col bg-gradient-to-b from-purple-900/40 to-black overflow-hidden">

                            <button
                                onClick={() => setIsSynthesisModalOpen(false)}
                                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white z-10"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex items-center justify-center gap-3 mb-6 shrink-0">
                                <Zap size={28} className="text-purple-400" />
                                <h3 className="text-2xl font-black text-white">夥伴合成</h3>
                            </div>

                            {!synthResult && !synthAnim && (
                                <div className="flex justify-center gap-4 mb-6 shrink-0">
                                    <button
                                        onClick={() => { setSynthRarity(3); setSelectedMaterials([]); }}
                                        className={`px-6 py-2 rounded-xl font-black transition-all ${synthRarity === 3 ? 'bg-sky-500/20 text-sky-400 border-2 border-sky-500' : 'bg-white/5 text-gray-400 border-2 border-transparent hover:bg-white/10'}`}
                                    >
                                        3★ 升 4★
                                    </button>
                                    <button
                                        onClick={() => { setSynthRarity(4); setSelectedMaterials([]); }}
                                        className={`px-6 py-2 rounded-xl font-black transition-all ${synthRarity === 4 ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500' : 'bg-white/5 text-gray-400 border-2 border-transparent hover:bg-white/10'}`}
                                    >
                                        4★ 升 5★
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto min-h-[300px] custom-scrollbar rounded-2xl bg-black/40 p-4 border border-white/5">
                                {synthAnim ? (
                                    <div className="h-full flex flex-col items-center justify-center">
                                        <Loader2 size={48} className="animate-spin text-purple-500 mb-4" />
                                        <p className="text-lg font-black text-purple-400 animate-pulse">靈魂融合中...</p>
                                    </div>
                                ) : synthResult ? (
                                    <div className="h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                                        <h4 className={`text-2xl font-black mb-6 flex items-center gap-2 ${synthSuccess ? 'text-game-gold' : 'text-gray-400'}`}>
                                            {synthSuccess ? <><Sparkles /> 合成成功！</> : '合成失敗，轉化為同星級夥伴'}
                                        </h4>
                                        <div className={`p-6 rounded-[32px] border-2 flex flex-col items-center relative min-w-[200px] ${RARITY_COLORS[synthResult!.rarity].border} ${RARITY_COLORS[synthResult!.rarity].bg} ${RARITY_COLORS[synthResult!.rarity].glow}`}>
                                            <div className="text-6xl mb-4 transform hover:scale-110 transition-transform">{synthResult!.avatar}</div>
                                            <div className="flex justify-center mb-3"><Stars n={synthResult!.rarity} /></div>
                                            <div className="font-black text-xl text-white mb-2">{synthResult!.name}</div>
                                            <div className="flex flex-col items-center gap-3">
                                                <RoleTag role={synthResult!.role} />
                                                <div className="text-xs font-mono text-gray-300 bg-black/40 px-3 py-1 rounded-xl border border-white/5">戰鬥力: {synthResult!.power}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setSynthResult(null); setSynthSuccess(null); }}
                                            className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-black rounded-xl transition-all"
                                        >
                                            繼續合成
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-sm font-bold text-gray-400">請選擇 4 張未上陣的同星級卡片做為材料</p>
                                            <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">已選: {selectedMaterials.length}/4</span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {player.partners
                                                .filter(p => p.rarity === synthRarity && !p.isDeployed)
                                                .map(p => {
                                                    const isSelected = selectedMaterials.includes(p.id);
                                                    return (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => toggleMaterialSelection(p.id)}
                                                            className={`aspect-[3/4] rounded-2xl border-2 flex flex-col items-center justify-center p-2 cursor-pointer transition-all relative
                                                            ${isSelected ? 'border-purple-500 bg-purple-500/20 scale-95 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : `border-transparent bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100`}
                                                        `}
                                                        >
                                                            {isSelected && (
                                                                <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-0.5 z-10 shadow-lg">
                                                                    <CheckCircle2 size={16} />
                                                                </div>
                                                            )}
                                                            <div className="text-3xl mb-2">{getLatestAvatar(p.name, p.avatar)}</div>
                                                            <div className="font-black text-xs text-center truncate w-full px-1">{p.name}</div>
                                                            <div className="mt-1 flex justify-center"><Stars n={p.rarity} /></div>
                                                        </div>
                                                    );
                                                })
                                            }
                                            {player.partners.filter(p => p.rarity === synthRarity && !p.isDeployed).length === 0 && (
                                                <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-50">
                                                    <Users size={32} className="mb-2" />
                                                    <p className="font-bold text-sm">沒有符合條件的未上陣夥伴</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!synthResult && !synthAnim && (
                                <div className="mt-6 shrink-0">
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-start gap-3">
                                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <h5 className="text-red-400 font-black text-sm mb-1">系統警告</h5>
                                            <p className="text-xs text-red-400/80 leading-relaxed font-bold">
                                                已獲得的夥伴如果作為材料進行合成，<span className="text-red-300">原本招募到的卡片將會永久消失</span>，並按照合成結果獲得 1 張全新的夥伴。請謹慎選擇！
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-xs text-gray-400 font-bold text-center sm:text-left">
                                            合成預覽: {synthRarity}★ <ArrowRight size={10} className="inline opacity-50 mx-1" /> {synthRarity === 3 ? '10% 機率獲取 4★' : '5% 機率獲取 5★'}<br />
                                            <span className="opacity-60 font-medium">(若合成失敗將隨機退還 1 張同星級卡片)</span>
                                        </div>
                                        <button
                                            onClick={handleSynthesis}
                                            disabled={selectedMaterials.length !== 4}
                                            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 disabled:bg-white/5 disabled:text-gray-500 text-white font-black py-3 px-8 rounded-xl transition-all shadow-[0_4px_15px_rgba(168,85,247,0.3)] disabled:shadow-none"
                                        >
                                            確認合成
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


