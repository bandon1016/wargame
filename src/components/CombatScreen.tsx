import React, { useState, useEffect, useRef } from 'react';
import type { CharacterStats, Enemy, Skill, WeatherType } from '../types/game';
import { SKILL_DATABASE, ELEMENT_META, WEATHER_TYPES } from '../types/game';
import { Shield, Sword, Heart, Play, Square, X, Award, PlusCircle, Zap, ChevronRight } from 'lucide-react';

interface CombatScreenProps {
    player: CharacterStats;
    enemy: Enemy;
    onWin: (exp: number, gold: number, skill?: Skill, lootTable?: any[], equipmentDrop?: any, finalHp?: number, finalMp?: number) => void;
    onLose: (finalHp?: number, finalMp?: number) => void;
    onFlee: () => void;
    autoExplore?: boolean;
    weather?: WeatherType;
    onAutoHeal?: () => void;
    onRevive?: () => void;
    onUseItem?: (item: any) => void;
    hasWeatherResistance: (type: WeatherType) => boolean;
}

export const CombatScreen: React.FC<CombatScreenProps> = ({ player, enemy, onWin, onLose, onFlee, autoExplore, weather, onAutoHeal, onRevive, onUseItem, hasWeatherResistance }) => {
    const [combatStats] = useState({
        attack: player.attack,
        defense: player.defense,
        maxHp: player.maxHp,
        maxMp: player.maxMp,
        heal: player.heal,
        level: player.level,
        skills: player.skills,
        nickname: player.nickname || '勇者',
    });

    const [eHp, setEHp] = useState(enemy.hp);
    const [pHp, setPHp] = useState(player.hp);
    const [pMp, setPMp] = useState(player.mp);
    const [logs, setLogs] = useState<string[]>([`⚔️ 野外遭遇了 ${enemy.name} (Lv.${enemy.level})！`]);
    const [auto, setAuto] = useState(autoExplore || false);
    const [ended, setEnded] = useState(false);
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [pShake, setPShake] = useState(false);
    const [eShake, setEShake] = useState(false);
    const [result, setResult] = useState<'win' | 'lose' | null>(null);
    const logRef = useRef<HTMLDivElement>(null);
    const [awaitingRevive, setAwaitingRevive] = useState(false);
    const [activeBuffs, setActiveBuffs] = useState<{ id: string; name: string; turns: number; type: string; power: number }[]>([]);
    const [enemyDebuffs, setEnemyDebuffs] = useState<{ id: string; name: string; type: string; turns: number; damage: number; icon: string }[]>([]);
    const [round, setRound] = useState(1);
    const revivePotCount = player.items.find(i => i.id === 'item_revive_pot')?.quantity || 0;

    useEffect(() => { logRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }); }, [logs]);

    useEffect(() => {
        if (!auto || ended || awaitingRevive || !isPlayerTurn) return;
        const tickRate = 1500; // 稍快一點的自動節奏 (1.5秒)
        const t = window.setTimeout(() => {
            executePlayerAttack();
        }, tickRate);
        return () => clearTimeout(t);
    }, [auto, isPlayerTurn, ended, awaitingRevive]);

    const log = (m: string) => setLogs(p => [...p, m]);

    const executePlayerAttack = () => {
        setIsPlayerTurn(false);

        // Auto Heal check
        if (auto && onAutoHeal && pHp < combatStats.maxHp * 0.4) {
            const pot = player.items.find(i => i.type === 'potion' && i.id !== 'item_revive_pot');
            if (pot) {
                log(`✨ 生命危急！自動使用藥水...`);
                onAutoHeal();
                let recover = 50;
                if (pot.id === 'item_hp_pot_m') recover = 150;
                const newHp = Math.min(pHp + recover, combatStats.maxHp);
                setPHp(newHp);
                setTimeout(() => executeMonsterTurn(eHp, newHp, pMp), 800);
                return;
            }
        }

        // Auto Skill check
        if (auto && combatStats.skills.length > 0) {
            // Find a skill that we can afford (prefer attack skills in auto)
            const availableSkills = combatStats.skills
                .map(ps => ({ ps, def: SKILL_DATABASE.find(s => s.id === ps.id) }))
                .filter(res => res.def && (pMp >= (res.def.baseMpCost + (res.ps.level - 1) * res.def.mpCostGrowth)));

            if (availableSkills.length > 0 && Math.random() > 0.5) {
                const pick = availableSkills[Math.floor(Math.random() * availableSkills.length)];
                handleUseSkill(pick.ps.id);
                return;
            }
        }

        const atkBuff = activeBuffs.filter(b => b.type === 'atk').reduce((sum, b) => sum + b.power, 0);

        // 天氣屬性傷害修飾
        const weatherMod = weather ? (WEATHER_TYPES[weather].elementMods?.[enemy.element] ?? 1.0) : 1.0;
        const pDmg = Math.max(1, Math.round(((combatStats.attack + atkBuff) - enemy.defense + Math.floor(Math.random() * 6)) * weatherMod));
        const newEHp = Math.max(0, eHp - pDmg);
        setEHp(newEHp);
        setEShake(true); setTimeout(() => setEShake(false), 300);
        log(`🗡️ 勇者揮出一擊，對 ${enemy.name} 造成 ${pDmg} 傷害`);

        if (newEHp <= 0) { win(newEHp, pHp, pMp); return; }

        // Brief pause before monster turn
        setTimeout(() => executeMonsterTurn(newEHp, pHp, pMp), 800);
    };

    const handleUseSkill = (skId: string) => {
        if (ended || !isPlayerTurn || awaitingRevive) return;
        const playerSkill = combatStats.skills.find(s => s.id === skId);
        const skillDef = SKILL_DATABASE.find(s => s.id === skId);
        if (!playerSkill || !skillDef) return;

        const mpCost = skillDef.baseMpCost + (playerSkill.level - 1) * skillDef.mpCostGrowth;
        if (pMp < mpCost) {
            log(`❌ 魔力不足！需要 ${mpCost} MP`);
            return;
        }

        setIsPlayerTurn(false);
        const nextMp = pMp - mpCost;
        setPMp(nextMp);

        const power = skillDef.basePower + (playerSkill.level - 1) * skillDef.powerGrowth;
        let currentEHp = eHp;
        let currentPHp = pHp;

        if (skillDef.type === 'attack') {
            const atkBuff = activeBuffs.filter(b => b.type === 'atk').reduce((sum, b) => sum + b.power, 0);
            // 雙重屬性連動：
            // 1. 技能本身的屬性受天氣加成（如：雷暴時「雷擊」傷害 ×1.2）
            // 2. 敵人弱點受天氣加成（如：雨天對水系怪物傷害 ×1.2）
            const skillElemMod = (weather && skillDef.element && skillDef.element !== 'neutral')
                ? (WEATHER_TYPES[weather].elementMods?.[skillDef.element] ?? 1.0)
                : 1.0;
            const enemyElemMod = weather ? (WEATHER_TYPES[weather].elementMods?.[enemy.element] ?? 1.0) : 1.0;
            const totalMod = skillElemMod * enemyElemMod;
            const dmg = Math.max(1, Math.round((power + Math.floor((combatStats.attack + atkBuff) * 0.5) - enemy.defense + Math.floor(Math.random() * 10)) * totalMod));
            currentEHp = Math.max(0, eHp - dmg);
            setEHp(currentEHp);
            setEShake(true); setTimeout(() => setEShake(false), 300);
            const elemTag = skillDef.element && skillDef.element !== 'neutral' ? ELEMENT_META[skillDef.element].icon : '';
            const boostTag = totalMod > 1.05 ? ` ✨天氣加持！` : totalMod < 0.95 ? ` 💧天氣減弱` : '';
            log(`${skillDef.icon}${elemTag} 使用了 ${skillDef.name}！對 ${enemy.name} 造成 ${dmg} 傷害${boostTag}`);

            // Apply debuff to enemy
            if (skillDef.debuff && currentEHp > 0) {
                const db = skillDef.debuff;
                const chance = db.baseChance + (playerSkill.level - 1) * db.chanceGrowth;
                if (Math.random() * 100 <= chance && db.type !== 'reflect' && db.type !== 'regen') {
                    const turns = Math.floor(db.baseDuration + (playerSkill.level - 1) * db.durationGrowth);
                    const dotDamage = Math.floor(db.baseDamage + (playerSkill.level - 1) * db.damageGrowth);

                    setEnemyDebuffs(prev => {
                        const existing = prev.find(d => d.type === db.type);
                        if (existing) {
                            return prev.map(d => d.type === db.type ? { ...d, turns: Math.max(d.turns, turns), damage: Math.max(d.damage, dotDamage) } : d);
                        } else {
                            return [...prev, { id: skillDef.id, name: skillDef.name, type: db.type, turns, damage: dotDamage, icon: skillDef.icon }];
                        }
                    });

                    const debuffNames: Record<string, string> = { burn: '持續燃燒', freeze: '持續凍傷', rend: '持續撕裂', shock: '持續電擊' };
                    log(`${skillDef.icon} ${enemy.name} 陷入了【${debuffNames[db.type]}】狀態！`);
                }
            }
            if (currentEHp <= 0) { win(currentEHp, currentPHp, nextMp); return; }
        } else if (skillDef.type === 'heal') {
            const heal = Math.floor(power + combatStats.level * 2);
            currentPHp = Math.min(combatStats.maxHp, pHp + heal);
            setPHp(currentPHp);
            log(`${skillDef.icon} 使用了 ${skillDef.name}！恢復了 ${heal} 點生命值`);

            if (skillDef.debuff && skillDef.debuff.type === 'regen') {
                const db = skillDef.debuff;
                const turns = Math.floor(db.baseDuration + (playerSkill.level - 1) * db.durationGrowth);
                const regenAmt = Math.floor(db.baseDamage + (playerSkill.level - 1) * db.damageGrowth);
                setActiveBuffs(prev => [...prev.filter(b => b.type !== 'regen'), { id: skillDef.id, name: skillDef.name, turns, type: 'regen', power: regenAmt }]);
                log(`💚 獲得【持續恢復】狀態，每回合恢復 ${regenAmt} HP，持續 ${turns} 回合！`);
            }
        } else if (skillDef.type === 'buff') {
            if (skillDef.debuff && skillDef.debuff.type === 'reflect') {
                const db = skillDef.debuff;
                const turns = Math.floor(db.baseDuration + (playerSkill.level - 1) * db.durationGrowth);
                const percent = Math.floor(db.baseDamage + (playerSkill.level - 1) * db.damageGrowth);
                setActiveBuffs(prev => [...prev.filter(b => b.type !== 'reflect'), { id: skillDef.id, name: skillDef.name, turns, type: 'reflect', power: percent }]);
                log(`${skillDef.icon} 使用了 ${skillDef.name}！獲得【反射傷害】狀態 (${percent}%)，持續 ${turns} 回合`);
            } else {
                setActiveBuffs(prev => [...prev.filter(b => b.type !== 'atk'), { id: skillDef.id, name: skillDef.name, turns: skillDef.durationTurns || 3, type: 'atk', power: power }]);
                log(`${skillDef.icon} 使用了 ${skillDef.name}！攻擊力提升了 ${power}，持續 ${skillDef.durationTurns} 回合`);
            }
        }

        setTimeout(() => executeMonsterTurn(currentEHp, currentPHp, nextMp), 800);
    };

    const executeMonsterTurn = (currentEHp: number, currentPHp: number, currentPMp: number) => {
        if (ended) return;

        let nextEHp = currentEHp;
        let nextPHp = currentPHp;

        // Process enemy DoTs
        if (enemyDebuffs.length > 0) {
            let totalDot = 0;
            const msgs: string[] = [];
            enemyDebuffs.forEach(d => {
                totalDot += d.damage;
                msgs.push(`${d.icon}`);
            });
            nextEHp = Math.max(0, nextEHp - totalDot);
            setEHp(nextEHp);
            setEShake(true); setTimeout(() => setEShake(false), 300);

            const txt = msgs.length > 1 ? msgs.join('') + ' ' : '';
            log(`${txt}魔物受到狀態影響，損失了 ${totalDot} 點生命值`);

            setEnemyDebuffs(prev => prev.map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0));

            if (nextEHp <= 0) { win(nextEHp, nextPHp, currentPMp); return; }
        }

        // Environmental Damage (Stormy)
        let stormDmgPlayer = 0;
        let stormDmgEnemy = 0;

        const weatherConf = weather ? WEATHER_TYPES[weather] : null;
        if (weather === 'stormy' && weatherConf && weatherConf.envDmgPerRounds > 0 && round % weatherConf.envDmgPerRounds === 0) {
            // Check god resistance for player
            const hasRes = hasWeatherResistance('stormy');

            stormDmgPlayer = hasRes ? 0 : Math.floor(combatStats.maxHp * 0.05);
            stormDmgEnemy = Math.floor(enemy.maxHp * 0.05);

            nextPHp = Math.max(0, nextPHp - stormDmgPlayer);
            nextEHp = Math.max(0, nextEHp - stormDmgEnemy);
            setPHp(nextPHp);
            setEHp(nextEHp);

            if (stormDmgPlayer > 0) setPShake(true);
            setEShake(true);
            setTimeout(() => { setPShake(false); setEShake(false); }, 300);

            if (hasRes) {
                log(`⚡ 狂雷劈下！魔物受到 ${stormDmgEnemy} 點傷害，你憑藉神明守護毫髮無傷`);
            } else {
                log(`⚡ 狂雷劈下！雙方分別受到 ${stormDmgPlayer} / ${stormDmgEnemy} 點環境傷害`);
            }

            if (nextEHp <= 0) { win(nextEHp, nextPHp, currentPMp); return; }
            if (nextPHp <= 0) { checkRevive(nextPHp, currentPMp); return; }
        }

        // Check Freeze Status
        const isFrozen = enemyDebuffs.some(d => d.type === 'freeze' && d.turns > 0);

        if (isFrozen) {
            log(`❄️ 魔物遭到冰凍，無法動彈！`);

            // Still process end of turn player buffs 
            let postPHp = nextPHp;
            if (combatStats.heal && combatStats.heal > 0 && nextPHp < combatStats.maxHp) {
                const regen = Math.min(combatStats.heal, combatStats.maxHp - nextPHp);
                postPHp = Math.min(postPHp + regen, combatStats.maxHp);
                setPHp(postPHp);
                log(`✨ 夥伴支援！治癒光輝恢復了 ${regen} 點生命`);
            }

            const regenBuff = activeBuffs.find(b => b.type === 'regen');
            if (regenBuff && postPHp < combatStats.maxHp) {
                const healAmt = Math.min(regenBuff.power, combatStats.maxHp - postPHp);
                postPHp = Math.min(postPHp + healAmt, combatStats.maxHp);
                setPHp(postPHp);
                log(`💚 持續恢復生傚！恢復了 ${healAmt} 點生命`);
            }

            processBuffsAndTurnEnd();
            return;
        }

        // Enemy attacks
        const eDmg = Math.max(1, enemy.attack - combatStats.defense + Math.floor(Math.random() * 4));
        const reflectBuff = activeBuffs.find(b => b.type === 'reflect');
        let reflectDmg = 0;
        if (reflectBuff) {
            reflectDmg = Math.floor(eDmg * (reflectBuff.power / 100));
        }

        const finalPHp = Math.max(0, nextPHp - eDmg);
        setPHp(finalPHp);
        setPShake(true); setTimeout(() => setPShake(false), 300);

        if (reflectBuff && reflectDmg > 0) {
            nextEHp = Math.max(0, nextEHp - reflectDmg);
            setEHp(nextEHp);
            setEShake(true);
            log(`${enemy.avatar} ${enemy.name} 發動攻擊，造成 ${eDmg} 傷害 (🛡️ 鐵壁反射了 ${reflectDmg} 傷害)`);
            if (nextEHp <= 0) { win(nextEHp, finalPHp, currentPMp); return; }
        } else {
            log(`${enemy.avatar} ${enemy.name} 發動攻擊，造成 ${eDmg} 傷害`);
        }

        if (finalPHp <= 0) {
            checkRevive(finalPHp, currentPMp);
        } else {
            // End of turn effects
            let postPHp = finalPHp;
            if (combatStats.heal && combatStats.heal > 0 && finalPHp < combatStats.maxHp) {
                const regen = Math.min(combatStats.heal, combatStats.maxHp - finalPHp);
                postPHp = Math.min(postPHp + regen, combatStats.maxHp);
                setPHp(postPHp);
                log(`✨ 夥伴支援！治癒光輝恢復了 ${regen} 點生命`);
            }

            const regenBuff = activeBuffs.find(b => b.type === 'regen');
            if (regenBuff && postPHp < combatStats.maxHp) {
                const healAmt = Math.min(regenBuff.power, combatStats.maxHp - postPHp);
                postPHp = Math.min(postPHp + healAmt, combatStats.maxHp);
                setPHp(postPHp);
                log(`💚 持續恢復生傚！恢復了 ${healAmt} 點生命`);
            }

            processBuffsAndTurnEnd();
        }
    };

    const processBuffsAndTurnEnd = () => {
        // Buff durations
        if (activeBuffs.length > 0) {
            setActiveBuffs(prev => prev.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0));
        }

        setIsPlayerTurn(true);
        setRound(r => r + 1);
    };

    const checkRevive = (hp: number, mp: number) => {
        if (revivePotCount > 0 && onRevive) {
            setAuto(false);
            setAwaitingRevive(true);
            log(`💧 檢測到背包中有【復甦精華】，是否使用？`);
        } else {
            lose(hp, mp);
        }
    };

    const handleUsePotion = (pot: any) => {
        if (!onUseItem || ended || (!isPlayerTurn && !auto)) return;
        onUseItem(pot);

        // Calculate recovery
        let recoverHp = 0;
        let recoverMp = 0;
        if (pot.id === 'item_hp_pot' || pot.id === 'it_01') recoverHp = 50;
        else if (pot.id === 'item_hp_pot_m') recoverHp = 150;
        else if (pot.id === 'item_mp_pot') recoverMp = 50;

        const newHp = Math.min(pHp + recoverHp, combatStats.maxHp);
        const newMp = Math.min(pMp + recoverMp, combatStats.maxMp);
        setPHp(newHp);
        setPMp(newMp);

        if (recoverHp > 0) log(`🧪 使用了【${pot.name}】，恢復了 ${Math.min(recoverHp, combatStats.maxHp - pHp)} 點生命值`);
        if (recoverMp > 0) log(`🧪 使用了【${pot.name}】，恢復了 ${Math.min(recoverMp, combatStats.maxMp - pMp)} 點魔力值`);

        if (!auto) {
            setIsPlayerTurn(false);
            setTimeout(() => executeMonsterTurn(eHp, newHp, pMp), 800);
        }
    };

    const handleRevive = () => {
        if (onRevive) {
            onRevive();
            setPHp(combatStats.maxHp);
            setAwaitingRevive(false);
            log(`✨ 使用了【復甦精華】，重獲新生！`);
            setIsPlayerTurn(true);
            if (autoExplore) setAuto(true);
        }
    };

    const win = (_finalEHp: number, finalPHp: number, finalPMp: number) => {
        setEnded(true); setAuto(false); setResult('win');
        log(`🎉 戰鬥勝利！獲得 ${enemy.expReward} EXP、${enemy.goldReward} G`);
        let sk: Skill | undefined;
        if (enemy.skillReward && Math.random() < 0.3) {
            sk = enemy.skillReward;
            log(`✨ 領悟新技能【${sk.icon} ${sk.name}】！`);
        }
        setTimeout(() => onWin(enemy.expReward, enemy.goldReward, sk, enemy.lootTable, (enemy as any).equipmentDrop, finalPHp, finalPMp), autoExplore ? 5000 : 3000);
    };

    const lose = (finalPHp: number, finalPMp: number) => {
        setEnded(true); setAuto(false); setResult('lose');
        log(`💀 勇者倒下了…`);
        setTimeout(() => onLose(finalPHp, finalPMp), autoExplore ? 5000 : 2500);
    };

    const hpPct = (cur: number, max: number) => Math.max(0, (cur / max) * 100);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[2000] flex items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-2xl h-full max-h-[850px] bg-[#0a0e1a]/95 rounded-3xl border border-white/10 shadow-2xl flex flex-col p-4 md:p-6 anim-fade-in-up overflow-hidden relative">

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
                        <div className="font-bold text-sm">{combatStats.nickname} <span className="text-gray-500 text-xs">Lv.{combatStats.level}</span></div>
                        {/* HP */}
                        <div className="w-full mt-2">
                            <div className="flex justify-between text-[11px] text-gray-400 mb-0.5"><span className="flex items-center gap-1"><Heart size={10} className="text-red-400" /> HP</span><span>{pHp}/{combatStats.maxHp}</span></div>
                            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bar-hp transition-all duration-500 rounded-full" style={{ width: `${hpPct(pHp, combatStats.maxHp)}%` }} />
                            </div>
                        </div>
                        {/* MP */}
                        <div className="w-full mt-1.5">
                            <div className="flex justify-between text-[11px] text-gray-400 mb-0.5"><span className="flex items-center gap-1 font-black text-blue-400">M MP</span><span>{pMp}/{combatStats.maxMp}</span></div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${hpPct(pMp, combatStats.maxMp)}%` }} />
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mt-2 text-[10px] text-gray-400">
                            <span className="flex items-center gap-1"><Sword size={10} className="text-red-400" /> {combatStats.attack}</span>
                            <span className="flex items-center gap-1"><Shield size={10} className="text-blue-400" /> {combatStats.defense}</span>
                            {combatStats.heal && combatStats.heal > 0 && <span className="flex items-center gap-1 text-emerald-400"><PlusCircle size={10} /> {combatStats.heal}</span>}
                        </div>
                    </div>

                    {/* Enemy */}
                    <div className={`glass-panel rounded-2xl p-4 flex flex-col items-center relative overflow-hidden ${eShake ? 'anim-shake' : ''}`}>
                        <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-game-danger/8 rounded-full blur-2xl" />
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-900/40 to-slate-900 border-2 border-game-danger/60 flex items-center justify-center text-5xl mb-2 anim-float anim-pulse-danger relative">
                            {enemy.avatar}
                            {enemyDebuffs.length > 0 && (
                                <div className="absolute -bottom-2 flex gap-0.5 justify-center w-full">
                                    {enemyDebuffs.map((d, i) => (
                                        <div key={i} className="text-[10px] bg-black/80 border border-white/20 rounded px-1 flex items-center gap-0.5" title={`${d.name} (${d.turns}回合)`}>
                                            {d.icon}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-game-danger">
                            {enemy.name} <span className="text-gray-500 text-xs">Lv.{enemy.level}</span>
                            {/* 屬性 Badge */}
                            {(() => {
                                const meta = ELEMENT_META[enemy.element];
                                const weatherBoost = weather ? (WEATHER_TYPES[weather].elementMods?.[enemy.element] ?? 1.0) : 1.0;
                                const isBuffed = weatherBoost > 1.0;
                                return (
                                    <span
                                        className={`element-badge ${isBuffed ? 'buffed' : ''}`}
                                        style={{ backgroundColor: meta.color + '33', color: meta.color, borderColor: meta.color + '66' }}
                                        title={`屬性：${meta.label}${isBuffed ? ` (天氣加成 x${weatherBoost.toFixed(2)})` : ''}`}
                                    >
                                        {meta.icon}
                                    </span>
                                );
                            })()}
                        </div>
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
                    {awaitingRevive ? (
                        <>
                            <button onClick={handleRevive} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
                                💧 使用復活道具 (剩餘: {revivePotCount})
                            </button>
                            <button onClick={() => lose(pHp, pMp)} className="flex-1 glass-panel border border-game-danger/40 text-game-danger font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/5">
                                <X size={16} /> 放棄戰鬥
                            </button>
                        </>
                    ) : (
                        <>
                            {!auto && !ended && (
                                <div className="flex flex-col w-full gap-3">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={executePlayerAttack}
                                            disabled={!isPlayerTurn}
                                            className="flex-1 bg-gradient-to-r from-game-accent to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-game-accent/20 disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            <Sword size={18} /> 攻擊
                                        </button>
                                        <button onClick={() => setAuto(true)} className="flex-1 glass-panel border border-game-accent/30 font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/5">
                                            <Play size={18} /> 自動
                                        </button>
                                    </div>
                                    {isPlayerTurn && combatStats.skills.length > 0 && (
                                        <div className="grid grid-cols-2 gap-2">
                                            {combatStats.skills.map(ps => {
                                                const sk = SKILL_DATABASE.find(s => s.id === ps.id);
                                                if (!sk) return null;
                                                const cost = sk.baseMpCost + (ps.level - 1) * sk.mpCostGrowth;
                                                // 計算技能天氣加成
                                                const elemMod = (weather && sk.element && sk.element !== 'neutral')
                                                    ? (WEATHER_TYPES[weather].elementMods?.[sk.element] ?? 1.0)
                                                    : 1.0;
                                                const isWeatherBuffed = elemMod > 1.0;
                                                const elemMeta = sk.element ? ELEMENT_META[sk.element] : null;
                                                return (
                                                    <button
                                                        key={ps.id}
                                                        onClick={() => handleUseSkill(ps.id)}
                                                        disabled={pMp < cost}
                                                        className={`glass-panel border p-2 rounded-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-30 ${isWeatherBuffed
                                                            ? 'border-amber-400/60 bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.2)] text-amber-200'
                                                            : 'border-white/10 hover:border-white/30 text-blue-200'
                                                            }`}
                                                    >
                                                        {/* Left: Icon with Element Badge corner */}
                                                        <div className="relative flex-shrink-0 w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                                                            <span className="text-xl">{sk.icon}</span>
                                                            {elemMeta && sk.element !== 'neutral' && (
                                                                <div
                                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/80 border border-white/20 flex items-center justify-center shadow-lg"
                                                                    style={{ color: elemMeta.color }}
                                                                >
                                                                    <span className="text-[10px]">{elemMeta.icon}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Center: Name & MP */}
                                                        <div className="flex-1 text-left min-w-0">
                                                            <div className="text-xs font-black truncate leading-tight mb-0.5 text-white">{sk.name}</div>
                                                            <div className="flex items-center gap-1">
                                                                <Zap size={10} className="text-game-accent" />
                                                                <span className="text-[10px] font-bold opacity-70">MP {cost}</span>
                                                            </div>
                                                        </div>

                                                        {/* Right: Buff Indicator */}
                                                        {isWeatherBuffed && (
                                                            <div className="flex flex-col items-center animate-bounce">
                                                                <span className="text-amber-400 text-[9px] font-black leading-none">UP</span>
                                                                <ChevronRight size={14} className="text-amber-400 rotate-[-90deg]" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            {auto && !ended && (
                                <button onClick={() => setAuto(false)} className="flex-1 glass-panel border border-game-danger/40 text-game-danger font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                    <Square size={16} /> 停止自動
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Quick Items for Manual Combat */}
                {!auto && !ended && !awaitingRevive && (
                    <div className="mt-4">
                        <div className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-wider">可用藥水</div>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {player.items.filter(i => i.type === 'potion' && i.id !== 'item_revive_pot').map(pot => (
                                <button
                                    key={pot.id}
                                    onClick={() => handleUsePotion(pot)}
                                    className="flex-shrink-0 glass-panel border border-white/10 p-2 rounded-xl flex items-center gap-2 hover:bg-white/5 active:scale-95 transition-all"
                                >
                                    <span className="text-xl">{pot.icon}</span>
                                    <div className="text-left">
                                        <div className="text-[11px] font-bold leading-tight">{pot.name}</div>
                                        <div className="text-[9px] text-gray-400">數量: {pot.quantity}</div>
                                    </div>
                                </button>
                            ))}
                            {player.items.filter(i => i.type === 'potion' && i.id !== 'item_revive_pot').length === 0 && (
                                <div className="text-[10px] text-gray-600 italic">背包中沒有可用藥水</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
