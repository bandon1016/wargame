export interface Skill {
    id: string;
    name: string;
    power: number;
    type: 'attack' | 'heal';
    description: string;
    icon: string; // emoji
}

export interface Equipment {
    id: string;
    name: string;
    slot: 'weapon' | 'armor' | 'helmet' | 'boots' | 'accessory';
    rarity: 1 | 2 | 3 | 4 | 5;
    attack: number;
    defense: number;
    hp: number;
    icon: string;
    description: string;
}

export interface GameItem {
    id: string;
    name: string;
    type: 'potion' | 'material' | 'scroll' | 'gem';
    icon: string;
    quantity: number;
    description: string;
}

export interface Partner {
    id: string;
    name: string;
    role: 'tank' | 'dps' | 'healer';
    rarity: 3 | 4 | 5;
    level: number;
    power: number;
    avatar: string; // emoji
}

export interface Building {
    id: string;
    name: string;
    type: 'gold_mine' | 'material_camp' | 'altar' | 'forge';
    level: number;
    baseProduction: number;
    upgradeCost: number;
    description: string;
    icon: string;
}

export interface CharacterStats {
    level: number;
    exp: number;
    maxExp: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    gold: number;
    baseMaterials: number;
    skills: Skill[];
    partners: Partner[];
    buildings: Building[];
    equipment: Equipment[];
    equippedWeapon?: Equipment;
    equippedArmor?: Equipment;
    equippedHelmet?: Equipment;
    equippedBoots?: Equipment;
    equippedAccessory?: Equipment;
    items: GameItem[];
}

export interface Enemy {
    id: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    expReward: number;
    goldReward: number;
    skillReward?: Skill;
    lootTable: GameItem[];
    avatar: string; // emoji
}

// 怪物列表 & 掉落資料
export const MONSTER_DATABASE = [
    { name: '史萊姆', avatar: '🟢', minLv: 1, maxLv: 5, baseHp: 40, baseAtk: 4, baseDef: 1 },
    { name: '哥布林', avatar: '👺', minLv: 1, maxLv: 8, baseHp: 55, baseAtk: 7, baseDef: 2 },
    { name: '野豬', avatar: '🐗', minLv: 3, maxLv: 12, baseHp: 80, baseAtk: 10, baseDef: 5 },
    { name: '骷髏兵', avatar: '💀', minLv: 5, maxLv: 15, baseHp: 70, baseAtk: 12, baseDef: 4 },
    { name: '石像鬼', avatar: '🗿', minLv: 8, maxLv: 20, baseHp: 120, baseAtk: 9, baseDef: 12 },
    { name: '火焰蜥蜴', avatar: '🦎', minLv: 10, maxLv: 25, baseHp: 100, baseAtk: 18, baseDef: 6 },
    { name: '暗影狼', avatar: '🐺', minLv: 12, maxLv: 30, baseHp: 90, baseAtk: 22, baseDef: 7 },
    { name: '冰霜巨人', avatar: '🧊', minLv: 20, maxLv: 40, baseHp: 200, baseAtk: 25, baseDef: 15 },
    { name: '黑龍', avatar: '🐉', minLv: 30, maxLv: 50, baseHp: 350, baseAtk: 40, baseDef: 20 },
];

export const SKILL_DATABASE: Skill[] = [
    { id: 'sk_slash', name: '旋風斬', power: 25, type: 'attack', description: '揮動武器造成範圍傷害', icon: '🌪️' },
    { id: 'sk_fireball', name: '火球術', power: 35, type: 'attack', description: '召喚火焰轟擊敵人', icon: '🔥' },
    { id: 'sk_heal', name: '治癒之光', power: 30, type: 'heal', description: '恢復自身 HP', icon: '💚' },
    { id: 'sk_thunder', name: '雷擊', power: 40, type: 'attack', description: '閃電從天而降', icon: '⚡' },
    { id: 'sk_iceblast', name: '冰爆', power: 30, type: 'attack', description: '冰晶碎片刺穿敵人', icon: '❄️' },
    { id: 'sk_shield', name: '鐵壁', power: 20, type: 'heal', description: '暫時提升防禦', icon: '🛡️' },
];

export const EQUIPMENT_DATABASE: Equipment[] = [
    { id: 'eq_wood_sword', name: '木劍', slot: 'weapon', rarity: 1, attack: 5, defense: 0, hp: 0, icon: '🗡️', description: '新手的初始武器' },
    { id: 'eq_iron_sword', name: '鐵劍', slot: 'weapon', rarity: 2, attack: 12, defense: 0, hp: 0, icon: '⚔️', description: '堅固的鐵製長劍' },
    { id: 'eq_flame_blade', name: '烈焰之刃', slot: 'weapon', rarity: 4, attack: 30, defense: 0, hp: 0, icon: '🔥', description: '附有火焰附魔的神兵' },
    { id: 'eq_leather_armor', name: '皮甲', slot: 'armor', rarity: 1, attack: 0, defense: 5, hp: 20, icon: '🧥', description: '簡易的皮革護甲' },
    { id: 'eq_chain_mail', name: '鎖子甲', slot: 'armor', rarity: 2, attack: 0, defense: 12, hp: 40, icon: '🛡️', description: '環環相扣的金屬鎧甲' },
    { id: 'eq_dragon_armor', name: '龍鱗鎧甲', slot: 'armor', rarity: 5, attack: 5, defense: 35, hp: 100, icon: '🐲', description: '以黑龍鱗片打造的傳說級鎧甲' },
    { id: 'eq_iron_helm', name: '鐵盔', slot: 'helmet', rarity: 2, attack: 0, defense: 8, hp: 15, icon: '⛑️', description: '保護頭部的鐵製頭盔' },
    { id: 'eq_leather_boots', name: '皮靴', slot: 'boots', rarity: 1, attack: 0, defense: 3, hp: 10, icon: '👢', description: '輕便的冒險者皮靴' },
    { id: 'eq_ruby_ring', name: '紅寶石戒指', slot: 'accessory', rarity: 3, attack: 10, defense: 5, hp: 30, icon: '💍', description: '鑲嵌紅寶石的魔法戒指' },
];

export const ITEM_DATABASE: Omit<GameItem, 'quantity'>[] = [
    { id: 'item_hp_pot', name: '生命藥水', type: 'potion', icon: '🧪', description: '恢復 50 HP' },
    { id: 'item_str_scroll', name: '力量卷軸', type: 'scroll', icon: '📜', description: '暫時提升 10 點攻擊力' },
    { id: 'item_iron_ore', name: '鐵礦石', type: 'material', icon: '🪨', description: '用於鍛造武器的基礎素材' },
    { id: 'item_magic_gem', name: '魔力寶石', type: 'gem', icon: '💎', description: '散發著微光的神秘寶石' },
    { id: 'item_herb', name: '藥草', type: 'material', icon: '🌿', description: '用於煉製藥水的草本植物' },
    { id: 'item_dragon_scale', name: '龍鱗碎片', type: 'material', icon: '🔮', description: '黑龍掉落的珍貴材料' },
];

export const RARITY_COLORS: Record<number, { border: string, bg: string, text: string, glow: string, label: string }> = {
    1: { border: 'border-gray-500', bg: 'bg-gray-800', text: 'text-gray-300', glow: '', label: '普通' },
    2: { border: 'border-green-500', bg: 'bg-green-900/30', text: 'text-green-400', glow: 'shadow-[0_0_8px_rgba(34,197,94,0.3)]', label: '優秀' },
    3: { border: 'border-blue-500', bg: 'bg-blue-900/30', text: 'text-blue-400', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]', label: '稀有' },
    4: { border: 'border-purple-500', bg: 'bg-purple-900/30', text: 'text-purple-400', glow: 'shadow-[0_0_16px_rgba(168,85,247,0.5)]', label: '史詩' },
    5: { border: 'border-game-gold', bg: 'bg-yellow-900/30', text: 'text-game-gold', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]', label: '傳說' },
};
