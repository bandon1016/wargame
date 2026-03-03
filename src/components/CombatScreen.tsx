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
    onMinimize?: () => void;
    onAutoHeal?: () => void;
    onRevive?: () => void;
    onUseItem?: (item: any) => void;
    hasWeatherResistance: (type: WeatherType) => boolean;
    isMinimized?: boolean;
    onMaximize?: () => void;
}

export const CombatScreen: React.FC<CombatScreenProps> = ({
    player, enemy, onWin, onLose, onFlee, autoExplore, weather,
    onAutoHeal, onRevive, onUseItem, hasWeatherResistance,
    isMinimized, onMaximize, onMinimize
}) => {
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
    const [activeBuffs, setActiveBuffs] = useState<{ id: string; name: string; turns: number; type: string; power: number; icon: string }[]>([]);
    const [enemyDebuffs, setEnemyDebuffs] = useState<{ id: string; name: string; type: string; turns: number; damage: number; icon: string }[]>([]);
    const [round, setRound] = useState(1);
    const [skillsExpanded, setSkillsExpanded] = useState(false);
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
                if (pot.id === 'item_hp_pot_m') recover = 200;
                if (pot.id === 'item_hp_pot_l') recover = 500;
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

        // 天氣/神明 命中率修飾
        let hitRate = 1.0;
        if (weather) {
            const wConf = WEATHER_TYPES[weather];
            if (!hasWeatherResistance(weather)) {
                hitRate = (wConf.hitMod ?? 1.0) / (wConf.evadeMod ?? 1.0);
            }
        }

        if (Math.random() > hitRate) {
            log(`💨 ${enemy.name} 閃開了你的攻擊！`);
            setTimeout(() => executeMonsterTurn(eHp, pHp, pMp), 800);
            return;
        }

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

            // 天氣/神明 命中率修飾
            let skillHitRate = 1.0;
            if (weather) {
                const wConf = WEATHER_TYPES[weather];
                if (!hasWeatherResistance(weather)) {
                    skillHitRate = (wConf.hitMod ?? 1.0) / (wConf.evadeMod ?? 1.0);
                }
            }

            if (Math.random() > skillHitRate) {
                log(`${skillDef.icon} 糟糕！${skillDef.name} 打空了！`);
                setTimeout(() => executeMonsterTurn(eHp, pHp, nextMp), 800);
                return;
            }
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
                setActiveBuffs(prev => [...prev.filter(b => b.type !== 'regen'), { id: skillDef.id, name: skillDef.name, turns, type: 'regen', power: regenAmt, icon: skillDef.icon }]);
                log(`💚 獲得【持續恢復】狀態，每回合恢復 ${regenAmt} HP，持續 ${turns} 回合！`);
            }
        } else if (skillDef.type === 'buff') {
            if (skillDef.debuff && skillDef.debuff.type === 'reflect') {
                const db = skillDef.debuff;
                const turns = Math.floor(db.baseDuration + (playerSkill.level - 1) * db.durationGrowth);
                const percent = Math.floor(db.baseDamage + (playerSkill.level - 1) * db.damageGrowth);
                setActiveBuffs(prev => [...prev.filter(b => b.type !== 'reflect'), { id: skillDef.id, name: skillDef.name, turns, type: 'reflect', power: percent, icon: skillDef.icon }]);
                log(`${skillDef.icon} 使用了 ${skillDef.name}！獲得【反射傷害】狀態 (${percent}%)，持續 ${turns} 回合`);
            } else {
                setActiveBuffs(prev => [...prev.filter(b => b.type !== 'atk'), { id: skillDef.id, name: skillDef.name, turns: skillDef.durationTurns || 3, type: 'atk', power: power, icon: skillDef.icon }]);
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

            // 延遲 2 秒執行夥伴恢復與持續恢復，增加辨識度
            setTimeout(() => {
                let postPHp = nextPHp;
                if (combatStats.heal && combatStats.heal > 0 && nextPHp < combatStats.maxHp) {
                    const regenVal = Math.min(combatStats.heal, combatStats.maxHp - nextPHp);
                    postPHp = Math.min(postPHp + regenVal, combatStats.maxHp);
                    setPHp(postPHp);
                    log(`✨ 夥伴支援！治癒光輝恢復了 ${regenVal} 點生命`);
                }

                const rBuff = activeBuffs.find(b => b.type === 'regen');
                if (rBuff && postPHp < combatStats.maxHp) {
                    const hAmt = Math.min(rBuff.power, combatStats.maxHp - postPHp);
                    postPHp = Math.min(postPHp + hAmt, combatStats.maxHp);
                    setPHp(postPHp);
                    log(`💚 持續恢復生傚！恢復了 ${hAmt} 點生命`);
                }

                processBuffsAndTurnEnd();
            }, 2000);
            return;
        }

        // 魔物 命中率修飾
        let monsterHitRate = 1.0;
        if (weather) {
            const wConf = WEATHER_TYPES[weather];
            // 魔物目前沒有神明護衛，固定受天氣影響 (命中率降低/閃避率提升)
            monsterHitRate = (wConf.hitMod ?? 1.0) / (wConf.evadeMod ?? 1.0);
        }

        if (Math.random() > monsterHitRate) {
            log(`💨 ${enemy.name} 的攻擊揮空了！你靈巧地躲開了。`);
            processBuffsAndTurnEnd();
            return;
        }

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
            // 延遲 2 秒執行夥伴恢復與持續恢復，讓玩家看清怪物攻擊後的狀態
            setTimeout(() => {
                let postPHp = finalPHp;
                if (combatStats.heal && combatStats.heal > 0 && finalPHp < combatStats.maxHp) {
                    const regenVal = Math.min(combatStats.heal, combatStats.maxHp - finalPHp);
                    postPHp = Math.min(postPHp + regenVal, combatStats.maxHp);
                    setPHp(postPHp);
                    log(`✨ 夥伴支援！治癒光輝恢復了 ${regenVal} 點生命`);
                }

                const rBuff = activeBuffs.find(b => b.type === 'regen');
                if (rBuff && postPHp < combatStats.maxHp) {
                    const hAmt = Math.min(rBuff.power, combatStats.maxHp - postPHp);
                    postPHp = Math.min(postPHp + hAmt, combatStats.maxHp);
                    setPHp(postPHp);
                    log(`💚 持續恢復生傚！恢復了 ${hAmt} 點生命`);
                }

                processBuffsAndTurnEnd();
            }, 2000);
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
        else if (pot.id === 'item_hp_pot_m') recoverHp = 200;
        else if (pot.id === 'item_hp_pot_l') recoverHp = 500;
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
        const er = enemy.expReward || 0;
        const gr = enemy.goldReward || 0;
        log(`🎉 戰鬥勝利！獲得 ${er} EXP、${gr} G`);
        let sk: Skill | undefined;
        if (enemy.skillReward && Math.random() < 0.3) {
            sk = enemy.skillReward;
            log(`✨ 領悟新技能【${sk.icon} ${sk.name}】！`);
        }
        setTimeout(() => onWin(er, gr, sk, enemy.lootTable, (enemy as any).equipmentDrop, finalPHp, finalPMp), autoExplore ? 2500 : 1500);
    };

    const lose = (finalPHp: number, finalPMp: number) => {
        setEnded(true); setAuto(false); setResult('lose');
        log(`💀 勇者倒下了…`);
        setTimeout(() => onLose(finalPHp, finalPMp), autoExplore ? 5000 : 2500);
    };

    const hpPct = (cur: number, max: number) => Math.max(0, (cur / max) * 100);

    if (isMinimized) {
        return (
            <div className="fixed bottom-24 right-4 z-[2500] pointer-events-auto">
                <button
                    onClick={onMaximize}
                    className="glass-panel p-3 rounded-2xl border border-white/20 shadow-2xl flex items-center gap-3 anim-scale-in hover:bg-white/5 transition-all active:scale-95 group w-48"
                >
                    <div className="relative">
                        <div className="text-3xl filter drop-shadow-sm group-hover:scale-110 transition-transform">
                            {enemy.avatar}
                        </div>
                        {/* Mini Enemy HP */}
                        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-black/40 rounded-full overflow-hidden border border-white/10">
                            <div
                                className="h-full bg-red-500 transition-all duration-300"
                                style={{ width: `${hpPct(eHp, enemy.maxHp)}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex-1 text-left">
                        <div className="text-[10px] font-black text-game-accent uppercase tracking-wider mb-0.5">戰鬥進行中...</div>
                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 mb-1">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${hpPct(pHp, combatStats.maxHp)}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold">
                            <span className="text-white/70">Lv.{enemy.level} {enemy.name}</span>
                        </div>
                    </div>

                    <div className="p-1.5 bg-game-accent/20 rounded-lg text-game-accent">
                        <ChevronRight size={16} />
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-6 pointer-events-none">
            <div className="w-full max-w-xl md:max-w-4xl h-[85vh] max-h-[780px] bg-[#0a0e1a]/90 backdrop-blur-md rounded-[2.5rem] border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col p-5 md:p-6 anim-fade-in-up overflow-hidden relative pointer-events-auto">

                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-game-danger flex items-center gap-2"><Sword size={20} /> 戰鬥</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onMinimize}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-bold transition text-gray-400 hover:text-white"
                        >
                            <ChevronRight size={14} className="rotate-90 md:rotate-0" /> 縮小
                        </button>
                        <button onClick={onFlee} disabled={ended} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-bold transition disabled:opacity-30"><X size={14} /> 撤退</button>
                    </div>
                </div>

                {/* ===== Main Content: Responsive Two-Column on Desktop ===== */}
                <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">

                    {/* ===== LEFT COLUMN: Characters + Log ===== */}
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                        {/* Combatants */}
                        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
                            {/* Player */}
                            <div className={`glass-panel rounded-2xl p-3 md:p-4 flex flex-col items-center relative overflow-hidden ${pShake ? 'anim-shake' : ''}`}>
                                <div className="absolute -right-6 -top-6 w-24 h-24 bg-game-accent/8 rounded-full blur-2xl" />
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-game-accent/60 flex items-center justify-center text-3xl md:text-4xl mb-2 anim-pulse-glow relative">
                                    🧙‍♂️
                                    {activeBuffs.length > 0 && (
                                        <div className="absolute -bottom-3 flex gap-1 justify-center w-full">
                                            {activeBuffs.map((b, i) => (
                                                <div key={i} className="text-sm bg-black/90 border border-white/30 rounded-md px-1.5 py-0.5 flex items-center gap-1 shadow-xl" title={`${b.name} (${b.turns}回合)`}>
                                                    {b.icon}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="font-bold text-xs md:text-sm">{combatStats.nickname} <span className="text-gray-500 text-xs">Lv.{combatStats.level}</span></div>
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
                            <div className={`glass-panel rounded-2xl p-3 md:p-4 flex flex-col items-center relative overflow-hidden ${eShake ? 'anim-shake' : ''}`}>
                                <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-game-danger/8 rounded-full blur-2xl" />
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-red-900/40 to-slate-900 border-2 border-game-danger/60 flex items-center justify-center text-4xl md:text-5xl mb-2 anim-float anim-pulse-danger relative">
                                    {enemy.avatar}
                                    {enemyDebuffs.length > 0 && (
                                        <div className="absolute -bottom-3 flex gap-1 justify-center w-full">
                                            {enemyDebuffs.map((d, i) => (
                                                <div key={i} className="text-sm bg-black/90 border border-white/30 rounded-md px-1.5 py-0.5 flex items-center gap-1 shadow-xl" title={`${d.name} (${d.turns}回合)`}>
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
                        <div ref={logRef} className="glass-panel flex-1 rounded-xl p-3 overflow-y-auto mb-3 space-y-1 font-mono text-[12px] leading-relaxed min-h-[120px]">
                            {logs.map((l, i) => (
                                <div key={i} className={
                                    l.includes('勇者') && !l.includes('倒下') ? 'text-game-accent' :
                                        l.includes('勝利') || l.includes('領悟') || l.includes('獲得') ? 'text-game-gold font-semibold' :
                                            l.includes('倒下') ? 'text-gray-500' : 'text-red-300'
                                }>&gt; {l}</div>
                            ))}
                        </div>
                    </div>

                    {/* ===== RIGHT COLUMN: Skills + Potions (Desktop Only) ===== */}
                    {!auto && !ended && !awaitingRevive && combatStats.skills.length > 0 && (
                        <div className="hidden md:flex md:flex-col md:w-72 gap-3 min-h-0 overflow-y-auto">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Zap size={12} className="text-game-accent" /> 技能
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {combatStats.skills.map(ps => {
                                    const sk = SKILL_DATABASE.find(s => s.id === ps.id);
                                    if (!sk) return null;
                                    const cost = sk.baseMpCost + (ps.level - 1) * sk.mpCostGrowth;
                                    const elemMod = (weather && sk.element && sk.element !== 'neutral')
                                        ? (WEATHER_TYPES[weather].elementMods?.[sk.element] ?? 1.0)
                                        : 1.0;
                                    const isWeatherBuffed = elemMod > 1.0;
                                    const elemMeta = sk.element ? ELEMENT_META[sk.element] : null;
                                    return (
                                        <button
                                            key={ps.id}
                                            onClick={() => handleUseSkill(ps.id)}
                                            disabled={pMp < cost || !isPlayerTurn}
                                            className={`glass-panel border p-2.5 rounded-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${isWeatherBuffed
                                                ? 'border-amber-400/60 bg-amber-400/5 shadow-[0_0_15px_rgba(251,191,36,0.2)] text-amber-200'
                                                : 'border-white/10 hover:border-white/30 text-blue-200'
                                                }`}
                                        >
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
                                            <div className="flex-1 text-left min-w-0">
                                                <div className="text-xs font-black truncate leading-tight mb-0.5 text-white">{sk.name}</div>
                                                <div className="flex items-center gap-1">
                                                    <Zap size={10} className="text-game-accent" />
                                                    <span className="text-[10px] font-bold opacity-70">MP {cost}</span>
                                                </div>
                                            </div>
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

                            {/* Desktop Potions */}
                            <div className="mt-auto pt-2 border-t border-white/5">
                                <div className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-wider">可用藥水</div>
                                <div className="flex flex-wrap gap-2">
                                    {player.items.filter(i =>
                                        (i.type === 'potion' || i.type === 'consumable') &&
                                        ['item_hp_pot', 'item_hp_pot_m', 'item_hp_pot_l', 'item_mp_pot', 'it_01'].includes(i.id) &&
                                        !['新道具', '製作道具', 'Crafted Item'].includes(i.name)
                                    ).map(pot => (
                                        <button
                                            key={pot.id}
                                            onClick={() => handleUsePotion(pot)}
                                            disabled={!isPlayerTurn}
                                            className="flex-shrink-0 glass-panel border border-white/10 p-2 rounded-xl flex items-center gap-2 hover:bg-white/5 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <span className="text-lg">{pot.icon}</span>
                                            <div className="text-left">
                                                <div className="text-[10px] font-bold leading-tight">{pot.name}</div>
                                                <div className="text-[9px] text-gray-400">x{pot.quantity}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {player.items.filter(i => i.type === 'potion' && i.id !== 'item_revive_pot').length === 0 && (
                                        <div className="text-[10px] text-gray-600 italic">無可用藥水</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ===== BOTTOM: Actions (Full Width) ===== */}
                <div className="flex gap-3 mt-3">
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
                                <div className="flex gap-3 w-full">
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
                            )}
                            {auto && !ended && (
                                <button onClick={() => setAuto(false)} className="flex-1 glass-panel border border-game-danger/40 text-game-danger font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                    <Square size={16} /> 停止自動
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* ===== MOBILE ONLY: Collapsible Skills + Potions ===== */}
                {!auto && !ended && !awaitingRevive && (
                    <div className="md:hidden mt-3">
                        {/* Toggle Skills */}
                        {combatStats.skills.length > 0 && (
                            <div>
                                <button
                                    onClick={() => setSkillsExpanded(!skillsExpanded)}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl glass-panel border border-white/10 mb-2 text-sm font-bold text-gray-300 hover:bg-white/5 transition-all"
                                >
                                    <span className="flex items-center gap-2"><Zap size={14} className="text-game-accent" /> 技能 ({combatStats.skills.length})</span>
                                    <ChevronRight size={16} className={`transition-transform duration-200 ${skillsExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                {skillsExpanded && (
                                    <div className="grid grid-cols-2 gap-2 mb-3 anim-fade-in-up">
                                        {combatStats.skills.map(ps => {
                                            const sk = SKILL_DATABASE.find(s => s.id === ps.id);
                                            if (!sk) return null;
                                            const cost = sk.baseMpCost + (ps.level - 1) * sk.mpCostGrowth;
                                            const elemMod = (weather && sk.element && sk.element !== 'neutral')
                                                ? (WEATHER_TYPES[weather].elementMods?.[sk.element] ?? 1.0)
                                                : 1.0;
                                            const isWeatherBuffed = elemMod > 1.0;
                                            const elemMeta = sk.element ? ELEMENT_META[sk.element] : null;
                                            return (
                                                <button
                                                    key={ps.id}
                                                    onClick={() => handleUseSkill(ps.id)}
                                                    disabled={pMp < cost || !isPlayerTurn}
                                                    className={`glass-panel border p-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${isWeatherBuffed
                                                        ? 'border-amber-400/60 bg-amber-400/5 text-amber-200'
                                                        : 'border-white/10 hover:border-white/30 text-blue-200'
                                                        }`}
                                                >
                                                    <div className="relative flex-shrink-0 w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                                                        <span className="text-base">{sk.icon}</span>
                                                        {elemMeta && sk.element !== 'neutral' && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 border border-white/20 flex items-center justify-center" style={{ color: elemMeta.color }}>
                                                                <span className="text-[8px]">{elemMeta.icon}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 text-left min-w-0">
                                                        <div className="text-[11px] font-black truncate leading-tight text-white">{sk.name}</div>
                                                        <div className="flex items-center gap-1">
                                                            <Zap size={9} className="text-game-accent" />
                                                            <span className="text-[9px] font-bold opacity-70">MP {cost}</span>
                                                        </div>
                                                    </div>
                                                    {isWeatherBuffed && (
                                                        <span className="text-amber-400 text-[8px] font-black animate-bounce">UP</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mobile Potions */}
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-wider">可用藥水</div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {player.items.filter(i =>
                                    (i.type === 'potion' || i.type === 'consumable') &&
                                    ['item_hp_pot', 'item_hp_pot_m', 'item_hp_pot_l', 'item_mp_pot', 'it_01'].includes(i.id) &&
                                    !['新道具', '製作道具', 'Crafted Item'].includes(i.name)
                                ).map(pot => (
                                    <button
                                        key={pot.id}
                                        onClick={() => handleUsePotion(pot)}
                                        disabled={!isPlayerTurn}
                                        className="flex-shrink-0 glass-panel border border-white/10 p-2 rounded-xl flex items-center gap-2 hover:bg-white/5 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
                    </div>
                )}
            </div>
        </div>
    );
};
