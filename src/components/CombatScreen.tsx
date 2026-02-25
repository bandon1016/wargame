import React, { useState, useEffect, useRef } from 'react';
import type { CharacterStats, Enemy, Skill } from '../types/game';
import { Shield, Sword, Heart, Play, Square, X, Award } from 'lucide-react';

interface CombatScreenProps {
    player: CharacterStats;
    enemy: Enemy;
    onWin: (exp: number, gold: number, skill?: Skill) => void;
    onLose: () => void;
    onFlee: () => void;
    autoExplore?: boolean;
    onAutoHeal?: () => void;
}

export const CombatScreen: React.FC<CombatScreenProps> = ({ player, enemy, onWin, onLose, onFlee, autoExplore, onAutoHeal }) => {
    const [eHp, setEHp] = useState(enemy.hp);
    const [pHp, setPHp] = useState(player.hp);
    const [logs, setLogs] = useState<string[]>([`⚔️ 野外遭遇了 ${enemy.name} (Lv.${enemy.level})！`]);
    const [auto, setAuto] = useState(autoExplore || false);
    const [ended, setEnded] = useState(false);
    const [pShake, setPShake] = useState(false);
    const [eShake, setEShake] = useState(false);
    const [result, setResult] = useState<'win' | 'lose' | null>(null);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => { logRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }); }, [logs]);

    useEffect(() => {
        if (!auto || ended) return;
        const tickRate = autoExplore ? 400 : 800; // Faster combat if global auto explore is on
        const t = window.setTimeout(turn, tickRate);
        return () => clearTimeout(t);
    }, [auto, pHp, eHp, ended]);

    const log = (m: string) => setLogs(p => [...p, m]);

    const turn = () => {
        if (ended) return;

        // Player attacks
        const pDmg = Math.max(1, player.attack - enemy.defense + Math.floor(Math.random() * 6));
        const newEHp = Math.max(0, eHp - pDmg);
        setEHp(newEHp);
        setEShake(true); setTimeout(() => setEShake(false), 300);
        log(`🗡️ 勇者揮出一擊，對 ${enemy.name} 造成 ${pDmg} 傷害`);

        if (newEHp <= 0) { win(); return; }

        // Auto Heal check for auto explore
        if (autoExplore && onAutoHeal && pHp < player.maxHp * 0.4) {
            log(`✨ 生命危急！自動嘗試使用藥水...`);
            onAutoHeal();
        }

        // Enemy attacks
        setTimeout(() => {
            const eDmg = Math.max(1, enemy.attack - player.defense + Math.floor(Math.random() * 4));
            const newPHp = Math.max(0, pHp - eDmg);
            setPHp(newPHp);
            setPShake(true); setTimeout(() => setPShake(false), 300);
            log(`${enemy.avatar} ${enemy.name} 反擊，造成 ${eDmg} 傷害`);
            if (newPHp <= 0) lose();
        }, 350);
    };

    const win = () => {
        setEnded(true); setAuto(false); setResult('win');
        log(`🎉 戰鬥勝利！獲得 ${enemy.expReward} EXP、${enemy.goldReward} G`);
        let sk: Skill | undefined;
        if (enemy.skillReward && Math.random() < 0.3) {
            sk = enemy.skillReward;
            log(`✨ 領悟新技能【${sk.icon} ${sk.name}】！`);
        }
        if (enemy.lootTable.length > 0) {
            enemy.lootTable.forEach(i => log(`📦 獲得道具：${i.icon} ${i.name} ×${i.quantity}`));
        }
        setTimeout(() => onWin(enemy.expReward, enemy.goldReward, sk), autoExplore ? 1000 : 3000);
    };

    const lose = () => {
        setEnded(true); setAuto(false); setResult('lose');
        log(`💀 勇者倒下了…`);
        setTimeout(() => onLose(), autoExplore ? 1500 : 2500);
    };

    const hpPct = (cur: number, max: number) => Math.max(0, (cur / max) * 100);

    return (
        <div className="absolute inset-0 bg-[#0a0e1a]/95 z-[2000] flex flex-col p-4 md:p-6 anim-fade-in-up">

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-game-danger flex items-center gap-2"><Sword size={20} /> 戰鬥</h2>
                <button onClick={onFlee} disabled={ended} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-bold transition disabled:opacity-30"><X size={14} /> 撤退</button>
            </div>

            {/* Combatants */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Player */}
                <div className={`glass-panel rounded-2xl p-4 flex flex-col items-center relative overflow-hidden ${pShake ? 'anim-shake' : ''}`}>
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-game-accent/8 rounded-full blur-2xl" />
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-game-accent/60 flex items-center justify-center text-4xl mb-2 anim-pulse-glow">
                        🧙‍♂️
                    </div>
                    <div className="font-bold text-sm">勇者 <span className="text-gray-500 text-xs">Lv.{player.level}</span></div>
                    {/* HP */}
                    <div className="w-full mt-2">
                        <div className="flex justify-between text-[11px] text-gray-400 mb-0.5"><span className="flex items-center gap-1"><Heart size={10} className="text-red-400" /> HP</span><span>{pHp}/{player.maxHp}</span></div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bar-hp transition-all duration-500 rounded-full" style={{ width: `${hpPct(pHp, player.maxHp)}%` }} />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-2 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><Sword size={10} className="text-red-400" /> {player.attack}</span>
                        <span className="flex items-center gap-1"><Shield size={10} className="text-blue-400" /> {player.defense}</span>
                    </div>
                </div>

                {/* Enemy */}
                <div className={`glass-panel rounded-2xl p-4 flex flex-col items-center relative overflow-hidden ${eShake ? 'anim-shake' : ''}`}>
                    <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-game-danger/8 rounded-full blur-2xl" />
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-900/40 to-slate-900 border-2 border-game-danger/60 flex items-center justify-center text-5xl mb-2 anim-float anim-pulse-danger">
                        {enemy.avatar}
                    </div>
                    <div className="font-bold text-sm text-game-danger">{enemy.name} <span className="text-gray-500 text-xs">Lv.{enemy.level}</span></div>
                    <div className="w-full mt-2">
                        <div className="flex justify-between text-[11px] text-gray-400 mb-0.5"><span className="flex items-center gap-1"><Heart size={10} className="text-red-400" /> HP</span><span>{eHp}/{enemy.maxHp}</span></div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bar-hp transition-all duration-500 rounded-full" style={{ width: `${hpPct(eHp, enemy.maxHp)}%` }} />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-2 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><Sword size={10} className="text-red-400" /> {enemy.attack}</span>
                        <span className="flex items-center gap-1"><Shield size={10} className="text-blue-400" /> {enemy.defense}</span>
                    </div>
                </div>
            </div>

            {/* Result Banner */}
            {result && (
                <div className={`text-center py-3 rounded-xl mb-3 font-bold text-lg flex items-center justify-center gap-2 anim-scale-in ${result === 'win' ? 'bg-game-gold/15 text-game-gold border border-game-gold/30' : 'bg-game-danger/15 text-game-danger border border-game-danger/30'}`}>
                    {result === 'win' ? <><Award size={20} /> 戰鬥勝利！</> : <>💀 戰鬥落敗</>}
                </div>
            )}

            {/* Log */}
            <div ref={logRef} className="glass-panel flex-1 rounded-xl p-3 overflow-y-auto mb-4 space-y-1 font-mono text-[12px] leading-relaxed min-h-0">
                {logs.map((l, i) => (
                    <div key={i} className={
                        l.includes('勇者') && !l.includes('倒下') ? 'text-game-accent' :
                            l.includes('勝利') || l.includes('領悟') || l.includes('獲得') ? 'text-game-gold font-semibold' :
                                l.includes('倒下') ? 'text-gray-500' : 'text-red-300'
                    }>&gt; {l}</div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                {!auto && !ended && (
                    <>
                        <button onClick={turn} className="flex-1 bg-gradient-to-r from-game-accent to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-game-accent/20">
                            <Sword size={18} /> 攻擊
                        </button>
                        <button onClick={() => setAuto(true)} className="flex-1 glass-panel border border-game-accent/30 font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/5">
                            <Play size={18} /> 自動
                        </button>
                    </>
                )}
                {auto && !ended && (
                    <button onClick={() => setAuto(false)} className="flex-1 glass-panel border border-game-danger/40 text-game-danger font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                        <Square size={16} /> 停止自動
                    </button>
                )}
            </div>
        </div>
    );
};
