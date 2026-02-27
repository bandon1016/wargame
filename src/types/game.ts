export interface SkillDebuff {
    type: 'burn' | 'reflect' | 'regen' | 'freeze' | 'rend' | 'shock';
    baseChance: number;      // Lv.1 時的基礎觸發機率 (%)
    chanceGrowth: number;    // 每級提升的觸發機率 (%)
    baseDuration: number;    // 基礎持續回合數
    durationGrowth: number;  // 每級提升的回合數
    baseDamage: number;      // 基礎持續傷害 / 基礎恢復量 / 反射比例等數值
    damageGrowth: number;    // 每級提升的傷害 / 恢復量 / 反射比例
}

export interface Skill {
    id: string;
    name: string;
    type: 'attack' | 'heal' | 'buff';
    description: string;
    icon: string; // emoji

    // 數值
    basePower: number;
    powerGrowth: number;
    baseMpCost: number;
    mpCostGrowth: number;

    // Buff 型態專用
    durationTurns?: number; // 持續回合

    debuff?: SkillDebuff;
}

export interface PlayerSkill {
    id: string;
    level: number;
    fragments: number; // 持有碎片數量
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
    type: 'potion' | 'material' | 'scroll' | 'gem' | 'consumable';
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
    exp: number;
    maxExp: number;
    power: number;
    avatar: string; // emoji
    isDeployed?: boolean;
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
    assignedPartners?: string[];
    isUpgrading?: boolean;
    upgradeEndsAt?: number | null; // Unix Timestamp (ms)
}

// 根據設施等級計算升級所需時間 (回傳毫秒)
// 公式：180秒(3分鐘) * (等級 ^ 1.8)
export const getBuildingUpgradeTime = (currentLevel: number): number => {
    const baseSeconds = 180;
    const growthFactor = 1.8;
    const requiredSeconds = Math.floor(baseSeconds * Math.pow(currentLevel, growthFactor));
    return requiredSeconds * 1000;
};

export interface Quest {
    id: string;
    title: string;
    description: string;
    targetType: 'collect' | 'kill';
    targetId: string; // item id or monster name
    requiredAmount: number;
    currentAmount: number;
    rewardGold: number;
    rewardExp: number;
    rewardItems?: { id: string, quantity: number }[];
}

export interface CharacterStats {
    nickname?: string;
    level: number;
    exp: number;
    maxExp: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    heal?: number;
    gold: number;
    baseMaterials: number;
    mp: number;
    maxMp: number;
    skills: PlayerSkill[];
    partners: Partner[];
    buildings: Building[];
    equipment: Equipment[];
    equippedWeapon?: Equipment | null;
    equippedArmor?: Equipment | null;
    equippedHelmet?: Equipment | null;
    equippedBoots?: Equipment | null;
    equippedAccessory?: Equipment | null;
    items: GameItem[];
    activeQuests?: Quest[];
    completedQuests?: string[];
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
    {
        id: 'sk_slash', name: '旋風斬', type: 'attack', description: '揮動武器造成範圍傷害', icon: '🌪️',
        basePower: 25, powerGrowth: 10, baseMpCost: 15, mpCostGrowth: 2,
        debuff: { type: 'rend', baseChance: 30, chanceGrowth: 2, baseDuration: 2, durationGrowth: 0, baseDamage: 10, damageGrowth: 4 }
    },
    {
        id: 'sk_fireball', name: '火球術', type: 'attack', description: '召喚火焰轟擊敵人', icon: '🔥',
        basePower: 35, powerGrowth: 15, baseMpCost: 25, mpCostGrowth: 3,
        debuff: { type: 'burn', baseChance: 40, chanceGrowth: 3, baseDuration: 3, durationGrowth: 0.1, baseDamage: 10, damageGrowth: 5 }
    },
    {
        id: 'sk_heal', name: '治癒之光', type: 'heal', description: '恢復自身 HP', icon: '💚',
        basePower: 30, powerGrowth: 12, baseMpCost: 20, mpCostGrowth: 2,
        debuff: { type: 'regen', baseChance: 100, chanceGrowth: 0, baseDuration: 3, durationGrowth: 0, baseDamage: 15, damageGrowth: 5 }
    },
    {
        id: 'sk_thunder', name: '雷擊', type: 'attack', description: '閃電從天而降', icon: '⚡',
        basePower: 40, powerGrowth: 18, baseMpCost: 30, mpCostGrowth: 4,
        debuff: { type: 'shock', baseChance: 25, chanceGrowth: 2, baseDuration: 2, durationGrowth: 0, baseDamage: 15, damageGrowth: 6 }
    },
    {
        id: 'sk_iceblast', name: '冰爆', type: 'attack', description: '冰晶碎片刺穿敵人', icon: '❄️',
        basePower: 30, powerGrowth: 15, baseMpCost: 20, mpCostGrowth: 3,
        debuff: { type: 'freeze', baseChance: 20, chanceGrowth: 1.5, baseDuration: 1, durationGrowth: 0.2, baseDamage: 5, damageGrowth: 2 }
    },
    {
        id: 'sk_shield', name: '鐵壁', type: 'buff', description: '暫時提升防禦', icon: '🛡️',
        basePower: 20, powerGrowth: 8, baseMpCost: 25, mpCostGrowth: 3, durationTurns: 3,
        debuff: { type: 'reflect', baseChance: 100, chanceGrowth: 0, baseDuration: 3, durationGrowth: 0, baseDamage: 15, damageGrowth: 2 } // baseDamage used as % reflect
    },
];

export const EQUIPMENT_DATABASE: Equipment[] = [
    // 台北城 (town_tpe) - 武器 Weapon
    { id: 'eq_wood_sword', name: '木劍', slot: 'weapon', rarity: 1, attack: 5, defense: 0, hp: 0, icon: '🗡️', description: '新手用的木製長劍' },
    { id: 'eq_iron_sword', name: '鐵劍', slot: 'weapon', rarity: 2, attack: 12, defense: 0, hp: 0, icon: '⚔️', description: '堅固的鐵製長劍' },
    { id: 'eq_steel_sword', name: '鋼鐵大劍', slot: 'weapon', rarity: 3, attack: 22, defense: 2, hp: 0, icon: '⚔️', description: '沉重而且極具破壞力的鋼鐵巨劍' },
    { id: 'eq_flame_blade', name: '烈焰之刃', slot: 'weapon', rarity: 4, attack: 35, defense: 0, hp: 0, icon: '🔥', description: '附有火焰附魔的神兵' },
    { id: 'eq_dragon_slayer', name: '屠龍巨劍', slot: 'weapon', rarity: 5, attack: 55, defense: 0, hp: 0, icon: '🗡️', description: '傳說中能斬下巨龍頭顱的巨劍' },

    // 新北城 (town_ntpc) - 盔甲 Armor
    { id: 'eq_leather_armor', name: '皮甲', slot: 'armor', rarity: 1, attack: 0, defense: 5, hp: 20, icon: '🧥', description: '簡易的皮革護甲' },
    { id: 'eq_chain_mail', name: '鎖子甲', slot: 'armor', rarity: 2, attack: 0, defense: 12, hp: 40, icon: '🛡️', description: '環環相扣的金屬鎧甲' },
    { id: 'eq_steel_armor', name: '鋼鐵重甲', slot: 'armor', rarity: 3, attack: 0, defense: 22, hp: 60, icon: '🛡️', description: '厚重的鋼鐵防護甲' },
    { id: 'eq_wood_armor', name: '神木護甲', slot: 'armor', rarity: 4, attack: 5, defense: 30, hp: 80, icon: '🌲', description: '由千年神木打造，充滿生命力' },
    { id: 'eq_dragon_armor', name: '龍鱗鎧甲', slot: 'armor', rarity: 5, attack: 5, defense: 45, hp: 120, icon: '🐲', description: '以龍鱗打造的傳說級鎧甲' },

    // 桃園城 (town_tyn) - 頭盔 Helmet
    { id: 'eq_leather_helm', name: '皮帽', slot: 'helmet', rarity: 1, attack: 0, defense: 3, hp: 10, icon: '🪖', description: '簡單的皮製頭巾' },
    { id: 'eq_iron_helm', name: '鐵盔', slot: 'helmet', rarity: 2, attack: 0, defense: 8, hp: 20, icon: '⛑️', description: '保護頭部的鐵製頭盔' },
    { id: 'eq_knight_helm', name: '騎士頭盔', slot: 'helmet', rarity: 3, attack: 0, defense: 12, hp: 35, icon: '🪖', description: '標準的騎士防護頭盔' },
    { id: 'eq_crystal_crown', name: '水晶王冠', slot: 'helmet', rarity: 4, attack: 5, defense: 15, hp: 50, icon: '👑', description: '鑲嵌水晶的魔法王冠' },
    { id: 'eq_dawn_helm', name: '破曉戰盔', slot: 'helmet', rarity: 5, attack: 10, defense: 25, hp: 80, icon: '🌅', description: '能夠抵禦極強攻擊的傳說戰盔' },

    // 台南城 (town_tnn) - 鞋子 Boots
    { id: 'eq_leather_boots', name: '皮靴', slot: 'boots', rarity: 1, attack: 0, defense: 3, hp: 10, icon: '👢', description: '輕便的冒險皮靴' },
    { id: 'eq_iron_boots_2', name: '鐵靴', slot: 'boots', rarity: 2, attack: 0, defense: 6, hp: 15, icon: '🥾', description: '底部加固的鐵皮靴' },
    { id: 'eq_steel_greaves', name: '鋼鐵護腿', slot: 'boots', rarity: 3, attack: 0, defense: 10, hp: 25, icon: '🥾', description: '提供極佳防護的鋼製戰靴' },
    { id: 'eq_lava_boots', name: '熔岩戰靴', slot: 'boots', rarity: 4, attack: 5, defense: 15, hp: 40, icon: '🌋', description: '能夠在極端地形中行走的炎之靴' },
    { id: 'eq_flame_boots', name: '踏炎神靴', slot: 'boots', rarity: 5, attack: 15, defense: 20, hp: 60, icon: '🔥', description: '傳說中可以踏過一切阻礙的神靴' },

    // 花蓮城 (town_hun) - 飾品 Accessory
    { id: 'eq_wood_amulet', name: '木雕護身符', slot: 'accessory', rarity: 1, attack: 1, defense: 1, hp: 10, icon: '🧿', description: '手工雕刻的有祈福作用的木牌' },
    { id: 'eq_iron_ring', name: '鐵戒指', slot: 'accessory', rarity: 2, attack: 5, defense: 2, hp: 15, icon: '💍', description: '打磨光滑的鐵製戒指' },
    { id: 'eq_ruby_ring', name: '红寶石戒指', slot: 'accessory', rarity: 3, attack: 10, defense: 5, hp: 30, icon: '💍', description: '散發著微火魔力的寶石戒指' },
    { id: 'eq_crystal_necklace', name: '水晶項鍊', slot: 'accessory', rarity: 4, attack: 5, defense: 10, hp: 60, icon: '📿', description: '能增幅法力的純淨水晶' },
    { id: 'eq_star_hourglass', name: '星辰沙漏', slot: 'accessory', rarity: 5, attack: 15, defense: 15, hp: 100, icon: '⏳', description: '蘊含時光與星辰之力的傳說寶物' }
];

export const ITEM_DATABASE: Omit<GameItem, 'quantity'>[] = [
    { id: 'item_hp_pot', name: '小型生命藥水', type: 'potion', icon: '🧪', description: '微微泛紅的初級藥水，能恢復 50 點生命值。' },
    { id: 'item_hp_pot_m', name: '中型生命藥水', type: 'potion', icon: '⚗️', description: '濃郁的紅色藥劑，能恢復 150 點生命值。' },
    { id: 'item_str_seed', name: '力量種子', type: 'consumable', icon: '💪', description: '蘊含神秘力量的種子，服用後永久提升 2 點攻擊力。' },
    { id: 'item_def_seed', name: '鐵壁種子', type: 'consumable', icon: '🛡️', description: '堅硬如鐵的種子，服用後永久提升 2 點防禦力。' },
    { id: 'item_hp_seed', name: '生命之果', type: 'consumable', icon: '🍎', description: '散發著生命氣息的果實，服用後永久提升 10 點最大生命值。' },
    { id: 'item_iron_ore', name: '鐵礦石', type: 'material', icon: '🔩', description: '可以用來鍛造基礎裝備的金屬原礦。' },
    { id: 'item_magic_gem', name: '魔力寶石', type: 'gem', icon: '🔮', description: '散發著幽藍微光的奇異寶石，蘊藏大量精純魔力。' },
    { id: 'item_herb', name: '藥草', type: 'material', icon: '🌿', description: '生長在野外的普通草本植物，是煉製各類藥水的基本材料。' },
    { id: 'item_dragon_scale', name: '龍鱗碎片', type: 'material', icon: '🐲', description: '強大黑龍掉落的珍貴鱗片，堅硬無比，散發著危險的氣息。' },
    { id: 'item_mp_pot', name: '魔力藥水', type: 'potion', icon: '💧', description: '閃爍著幽藍光芒的藥水，能恢復 50 點魔力值。' },
    { id: 'item_revive_pot', name: '復甦精華', type: 'potion', icon: '💧', description: '閃耀著奇蹟般光芒的泉水，不僅能恢復生命，還能在戰敗時將角色滿血復活。' },
    // Regional Materials
    { id: 'mat_north_tech', name: '科技廢料', type: 'material', icon: '⚙️', description: '北部特產：沾染微弱魔力的報廢電路板。' },
    { id: 'mat_north_glass', name: '魔法玻璃', type: 'material', icon: '🪷', description: '北部特產：折射著奇幻光芒的玻璃碎片，可用於光學附魔。' },
    { id: 'mat_central_iron', name: '高山鐵礦', type: 'material', icon: '⛰️', description: '中部特產：只有在中央山脈深處才挖得到的極堅硬礦石。' },
    { id: 'mat_central_wood', name: '神木枝枒', type: 'material', icon: '🍃', description: '中部特產：受到古老森林魔力滋養的千年樹枝。' },
    { id: 'mat_south_sand', name: '炎漠紅砂', type: 'material', icon: '🏜️', description: '南部特產：蘊含濃烈火屬性魔力的紅色砂礫。' },
    { id: 'mat_south_pearl', name: '海淵珍珠', type: 'material', icon: '🦪', description: '南部特產：凝聚大洋水屬性精華的璀璨珍珠。' },
    { id: 'mat_east_crystal', name: '花東水晶', type: 'material', icon: '💠', description: '東部特產：純淨無瑕的天然水晶，能大幅增幅魔力。' },
    { id: 'mat_coral', name: '珊瑚碎片', type: 'material', icon: '🌺', description: '屏東特產：沾著濃厚海洋魔力的礁石碎片。' },
    { id: 'mat_basalt', name: '玄武岩礦石', type: 'material', icon: '🌑', description: '台東特產：花東縱谷出產的堅硬黑色岩石。' },
    { id: 'mat_ancient_wood', name: '太古神木', type: 'material', icon: '🌲', description: '台中稀有：更高品質的千年神木原木，蒸餾著古老欲力。' },
    { id: 'mat_lava_sand', name: '熔岩紅砂', type: 'material', icon: '🌋', description: '台南稀有：比炎漠紅砂更濃縮的極品火屬性砂礫。' },
];

// Crafting Recipes
export interface BlacksmithRecipe {
    id: string;
    targetEquipmentId: string;
    materials: { id: string, name: string, quantity: number }[];
    goldCost: number;
    cityId?: string;
}

export const BLACKSMITH_RECIPES: BlacksmithRecipe[] = [
    // 台北城 (town_tpe) - 武器 Weapon
    { id: 'forge_wood_sword', targetEquipmentId: 'eq_wood_sword', cityId: 'town_tpe', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 2 }, { id: 'item_herb', name: '藥草', quantity: 1 }], goldCost: 50 },
    { id: 'forge_iron_sword', targetEquipmentId: 'eq_iron_sword', cityId: 'town_tpe', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }, { id: 'mat_north_tech', name: '科技廢料', quantity: 1 }], goldCost: 200 },
    { id: 'forge_steel_sword', targetEquipmentId: 'eq_steel_sword', cityId: 'town_tpe', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 10 }, { id: 'mat_north_tech', name: '科技廢料', quantity: 3 }], goldCost: 500 },
    { id: 'forge_flame_blade', targetEquipmentId: 'eq_flame_blade', cityId: 'town_tpe', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 15 }, { id: 'mat_north_glass', name: '魔法玻璃', quantity: 3 }, { id: 'item_magic_gem', name: '魔力寶石', quantity: 1 }], goldCost: 1500 },
    { id: 'forge_dragon_slayer', targetEquipmentId: 'eq_dragon_slayer', cityId: 'town_tpe', materials: [{ id: 'item_dragon_scale', name: '龍鱗碎片', quantity: 5 }, { id: 'mat_north_glass', name: '魔法玻璃', quantity: 5 }, { id: 'mat_central_iron', name: '高山鐵礦', quantity: 5 }], goldCost: 5000 },

    // 新北城 (town_ntpc) - 盔甲 Armor
    { id: 'forge_leather_armor', targetEquipmentId: 'eq_leather_armor', cityId: 'town_ntpc', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 2 }, { id: 'item_herb', name: '藥草', quantity: 1 }], goldCost: 50 },
    { id: 'forge_chain_mail', targetEquipmentId: 'eq_chain_mail', cityId: 'town_ntpc', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }], goldCost: 200 },
    { id: 'forge_steel_armor', targetEquipmentId: 'eq_steel_armor', cityId: 'town_ntpc', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 10 }, { id: 'mat_central_iron', name: '高山鐵礦', quantity: 2 }], goldCost: 600 },
    { id: 'forge_wood_armor', targetEquipmentId: 'eq_wood_armor', cityId: 'town_ntpc', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 15 }, { id: 'mat_central_wood', name: '神木枝枒', quantity: 5 }], goldCost: 1600 },
    { id: 'forge_dragon_armor', targetEquipmentId: 'eq_dragon_armor', cityId: 'town_ntpc', materials: [{ id: 'item_dragon_scale', name: '龍鱗碎片', quantity: 5 }, { id: 'mat_central_iron', name: '高山鐵礦', quantity: 10 }, { id: 'item_magic_gem', name: '魔力寶石', quantity: 2 }], goldCost: 5500 },

    // 桃園城 (town_tyn) - 頭盔 Helmet
    { id: 'forge_leather_helm', targetEquipmentId: 'eq_leather_helm', cityId: 'town_tyn', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 2 }], goldCost: 40 },
    { id: 'forge_iron_helm', targetEquipmentId: 'eq_iron_helm', cityId: 'town_tyn', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }], goldCost: 150 },
    { id: 'forge_knight_helm', targetEquipmentId: 'eq_knight_helm', cityId: 'town_tyn', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 10 }, { id: 'mat_central_iron', name: '高山鐵礦', quantity: 2 }], goldCost: 500 },
    { id: 'forge_crystal_crown', targetEquipmentId: 'eq_crystal_crown', cityId: 'town_tyn', materials: [{ id: 'mat_east_crystal', name: '花東水晶', quantity: 3 }, { id: 'item_magic_gem', name: '魔力寶石', quantity: 2 }], goldCost: 1800 },
    { id: 'forge_dawn_helm', targetEquipmentId: 'eq_dawn_helm', cityId: 'town_tyn', materials: [{ id: 'item_dragon_scale', name: '龍鱗碎片', quantity: 3 }, { id: 'mat_central_iron', name: '高山鐵礦', quantity: 8 }, { id: 'item_magic_gem', name: '魔力寶石', quantity: 3 }], goldCost: 4500 },

    // 台南城 (town_tnn) - 鞋子 Boots
    { id: 'forge_leather_boots', targetEquipmentId: 'eq_leather_boots', cityId: 'town_tnn', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 2 }], goldCost: 40 },
    { id: 'forge_iron_boots_2', targetEquipmentId: 'eq_iron_boots_2', cityId: 'town_tnn', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }, { id: 'mat_south_sand', name: '炎漠紅砂', quantity: 1 }], goldCost: 180 },
    { id: 'forge_steel_greaves', targetEquipmentId: 'eq_steel_greaves', cityId: 'town_tnn', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 10 }, { id: 'mat_south_sand', name: '炎漠紅砂', quantity: 3 }], goldCost: 700 },
    { id: 'forge_lava_boots', targetEquipmentId: 'eq_lava_boots', cityId: 'town_tnn', materials: [{ id: 'mat_lava_sand', name: '熔岩紅砂', quantity: 4 }, { id: 'mat_central_iron', name: '高山鐵礦', quantity: 5 }], goldCost: 2000 },
    { id: 'forge_flame_boots', targetEquipmentId: 'eq_flame_boots', cityId: 'town_tnn', materials: [{ id: 'mat_lava_sand', name: '熔岩紅砂', quantity: 8 }, { id: 'item_dragon_scale', name: '龍鱗碎片', quantity: 3 }, { id: 'item_magic_gem', name: '魔力寶石', quantity: 2 }], goldCost: 5200 },

    // 花蓮城 (town_hun) - 飾品 Accessory
    { id: 'forge_wood_amulet', targetEquipmentId: 'eq_wood_amulet', cityId: 'town_hun', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 2 }, { id: 'item_herb', name: '藥草', quantity: 2 }], goldCost: 60 },
    { id: 'forge_iron_ring', targetEquipmentId: 'eq_iron_ring', cityId: 'town_hun', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 6 }], goldCost: 250 },
    { id: 'forge_ruby_ring', targetEquipmentId: 'eq_ruby_ring', cityId: 'town_hun', materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 8 }, { id: 'mat_east_crystal', name: '花東水晶', quantity: 2 }], goldCost: 900 },
    { id: 'forge_crystal_necklace', targetEquipmentId: 'eq_crystal_necklace', cityId: 'town_hun', materials: [{ id: 'mat_east_crystal', name: '花東水晶', quantity: 5 }, { id: 'item_magic_gem', name: '魔力寶石', quantity: 2 }], goldCost: 2400 },
    { id: 'forge_star_hourglass', targetEquipmentId: 'eq_star_hourglass', cityId: 'town_hun', materials: [{ id: 'mat_east_crystal', name: '花東水晶', quantity: 8 }, { id: 'item_magic_gem', name: '魔力寶石', quantity: 5 }, { id: 'item_dragon_scale', name: '龍鱗碎片', quantity: 2 }], goldCost: 6000 }
];

// Alchemy Recipes
export interface AlchemyRecipe {
    id: string;
    targetItemId: string;
    materials: { id: string, name: string, quantity: number }[];
    goldCost: number;
    cityId?: string;
}

export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
    {
        id: 'rec_hp_pot',
        targetItemId: 'item_hp_pot',
        materials: [
            { id: 'item_herb', name: '藥草', quantity: 2 }
        ],
        goldCost: 20
    },
    {
        id: 'rec_mp_pot',
        targetItemId: 'item_mp_pot',
        materials: [
            { id: 'item_herb', name: '藥草', quantity: 2 },
            { id: 'item_magic_gem', name: '魔力寶石', quantity: 1 }
        ],
        goldCost: 50
    },
    {
        id: 'rec_hp_pot_m',
        targetItemId: 'item_hp_pot_m',
        materials: [
            { id: 'item_herb', name: '藥草', quantity: 4 },
            { id: 'item_hp_pot', name: '小型生命藥水', quantity: 1 }
        ],
        goldCost: 50
    },
    {
        id: 'rec_revive_pot',
        targetItemId: 'item_revive_pot',
        materials: [
            { id: 'item_magic_gem', name: '魔力寶石', quantity: 1 },
            { id: 'mat_north_glass', name: '魔法玻璃', quantity: 1 },
            { id: 'mat_south_pearl', name: '海淵珍珠', quantity: 1 }
        ],
        goldCost: 500
    },
    // City-exclusive alchemy recipes
    {
        id: 'rec_tech_boost', targetItemId: 'item_str_seed', cityId: 'town_tpe',
        materials: [{ id: 'mat_north_tech', name: '科技廢料', quantity: 3 }, { id: 'mat_north_glass', name: '魔法玻璃', quantity: 1 }],
        goldCost: 80
    },
    {
        id: 'rec_optic_def', targetItemId: 'item_def_seed', cityId: 'town_tpe',
        materials: [{ id: 'mat_north_glass', name: '魔法玻璃', quantity: 3 }, { id: 'item_herb', name: '藥草', quantity: 2 }],
        goldCost: 120
    },
    {
        id: 'rec_lava_boost', targetItemId: 'item_str_seed', cityId: 'town_tnn',
        materials: [{ id: 'mat_lava_sand', name: '熔岩紅砂', quantity: 2 }, { id: 'mat_south_sand', name: '炎漠紅砂', quantity: 3 }],
        goldCost: 200
    },
    {
        id: 'rec_sea_heal', targetItemId: 'item_hp_pot_m', cityId: 'town_khh',
        materials: [{ id: 'mat_south_pearl', name: '海淵珍珠', quantity: 1 }, { id: 'item_herb', name: '藥草', quantity: 3 }],
        goldCost: 80
    },
    {
        id: 'rec_crystal_life', targetItemId: 'item_hp_seed', cityId: 'town_hun',
        materials: [{ id: 'mat_east_crystal', name: '花東水晶', quantity: 2 }, { id: 'item_herb', name: '藥草', quantity: 2 }],
        goldCost: 150
    },
];

// Region definitions
export type RegionType = 'north' | 'central' | 'south' | 'east' | 'unknown';

export const getRegionByCoordinates = (lat: number, lng: number): RegionType => {
    // 東部地區判定：中央山脈以東 (約 121.0E 以東，但不含宜蘭)
    if (lng > 121.0 && lat <= 24.5) return 'east';

    // 西部地區依據緯度判定
    if (lat > 24.5) return 'north';
    if (lat > 23.5 && lat <= 24.5) return 'central';
    if (lat > 21.8 && lat <= 23.5) return 'south';
    return 'unknown';
};

export const getRegionByCityName = (cityName: string): RegionType => {
    const north = ['臺北', '台北', '新北', '基隆', '桃園', '新竹', '宜蘭'];
    const central = ['臺中', '台中', '苗栗', '彰化', '南投', '雲林'];
    const south = ['高雄', '臺南', '台南', '嘉義', '屏東', '澎湖'];
    const east = ['花蓮', '臺東', '台東'];

    if (north.some(c => cityName.includes(c))) return 'north';
    if (central.some(c => cityName.includes(c))) return 'central';
    if (south.some(c => cityName.includes(c))) return 'south';
    if (east.some(c => cityName.includes(c))) return 'east';
    return 'unknown';
};

export const getRegionalMaterials = (region: RegionType): string[] => {
    switch (region) {
        case 'north': return ['mat_north_tech', 'mat_north_glass'];
        case 'central': return ['mat_central_iron', 'mat_central_wood', 'mat_ancient_wood'];
        case 'south': return ['mat_south_sand', 'mat_south_pearl', 'mat_lava_sand', 'mat_coral'];
        case 'east': return ['mat_east_crystal', 'mat_basalt'];
        default: return [];
    }
};

// Weather System
export type WeatherType = 'sunny' | 'rainy' | 'foggy' | 'stormy';

export interface WeatherEffect {
    weather: WeatherType;
    icon: string;
    label: string;
    description: string;
}

export const WEATHER_TYPES: Record<WeatherType, WeatherEffect> = {
    sunny: { weather: 'sunny', icon: '☀️', label: '晴天', description: '天氣晴朗，視野清晰。' },
    rainy: { weather: 'rainy', icon: '🌧️', label: '雨天', description: '大雨滂沱，水系怪物稍微轉強。' },
    foggy: { weather: 'foggy', icon: '🌫️', label: '濃霧', description: '能見度極低，遇敵機率大幅上升。' },
    stormy: { weather: 'stormy', icon: '⚡', label: '雷暴', description: '狂雷交加，戰鬥中有機率受到環境傷害。' },
};

export const RARITY_COLORS: Record<number, { border: string, bg: string, text: string, glow: string, label: string }> = {
    1: { border: 'border-slate-500', bg: 'bg-slate-900/50', text: 'text-slate-300', glow: '', label: '普通' },
    2: { border: 'border-emerald-500', bg: 'bg-emerald-900/40', text: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]', label: '優秀' },
    3: { border: 'border-sky-500', bg: 'bg-sky-900/40', text: 'text-sky-400', glow: 'shadow-[0_0_20px_rgba(14,165,233,0.3)]', label: '稀有' },
    4: { border: 'border-purple-500', bg: 'bg-purple-900/40', text: 'text-purple-400', glow: 'shadow-[0_0_25px_rgba(168,85,247,0.4)]', label: '史詩' },
    5: { border: 'border-amber-500', bg: 'bg-amber-900/40', text: 'text-amber-400', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.5)]', label: '傳說' },
};

// Towns & Field Events
export interface Town {
    id: string;
    name: string;
    lat: number;
    lng: number;
    radius: number; // trigger radius in meters
    color: string;
    facilities: ('market' | 'blacksmith' | 'alchemy' | 'station' | 'quest_board' | 'shipyard' | 'dock')[];
}

export const TOWN_DATABASE: Town[] = [
    { id: 'town_tpe', name: '台北城', lat: 25.0330, lng: 121.5654, radius: 2000, color: '#3b82f6', facilities: ['market', 'blacksmith', 'alchemy', 'station', 'quest_board'] },
    { id: 'town_ntpc', name: '新北城', lat: 25.0169, lng: 121.4627, radius: 2000, color: '#6366f1', facilities: ['market', 'blacksmith', 'station', 'quest_board'] },
    { id: 'town_tyn', name: '桃園城', lat: 24.9931, lng: 121.3010, radius: 2000, color: '#14b8a6', facilities: ['market', 'blacksmith', 'station', 'quest_board'] },
    { id: 'town_txg', name: '台中城', lat: 24.1477, lng: 120.6736, radius: 2000, color: '#f59e0b', facilities: ['market', 'blacksmith', 'alchemy', 'station', 'quest_board', 'dock'] },
    { id: 'town_tnn', name: '台南城', lat: 22.9997, lng: 120.2270, radius: 2000, color: '#ef4444', facilities: ['market', 'blacksmith', 'alchemy', 'station', 'quest_board'] },
    { id: 'town_khh', name: '高雄城', lat: 22.6272, lng: 120.3014, radius: 2000, color: '#eab308', facilities: ['market', 'blacksmith', 'alchemy', 'station', 'quest_board', 'shipyard', 'dock'] },
    { id: 'town_pif', name: '屏東城', lat: 22.004, lng: 120.745, radius: 2000, color: '#f97316', facilities: ['market', 'blacksmith', 'station', 'quest_board'] },
    { id: 'town_ttu', name: '台東城', lat: 22.7931, lng: 121.1248, radius: 2000, color: '#8b5cf6', facilities: ['market', 'blacksmith', 'station', 'quest_board'] },
    { id: 'town_hun', name: '花蓮城', lat: 23.9936, lng: 121.5972, radius: 2000, color: '#ec4899', facilities: ['market', 'blacksmith', 'station', 'quest_board', 'dock'] }
];

export const RAILWAY_NETWORK: Record<string, [number, number][]> = {
    'town_tpe-town_ntpc': [[25.0330, 121.5654], [25.0169, 121.4627]],
    'town_ntpc-town_tyn': [[25.0169, 121.4627], [24.9931, 121.3010]],
    'town_tyn-town_txg': [[24.9931, 121.3010], [24.8138, 120.9675], [24.5601, 120.8209], [24.1477, 120.6736]],
    'town_txg-town_tnn': [[24.1477, 120.6736], [23.70, 120.54], [23.4791, 120.4497], [22.9997, 120.2270]],
    'town_tnn-town_khh': [[22.9997, 120.2270], [22.85, 120.25], [22.6272, 120.3014]],
    'town_khh-town_pif': [[22.6272, 120.3014], [22.6685, 120.4862], [22.55, 120.54], [22.3688, 120.5982], [22.0722, 120.7153], [22.004, 120.745]],
    'town_pif-town_ttu': [[22.004, 120.745], [22.15, 120.82], [22.35, 120.90], [22.55, 120.98], [22.7931, 121.1248]],
    'town_ttu-town_hun': [[22.7931, 121.1248], [23.00, 121.25], [23.1092, 121.3789], [23.4795, 121.4673], [23.75, 121.55], [23.9936, 121.5972]],
    'town_hun-town_tpe': [[23.9936, 121.5972], [24.15, 121.65], [24.4025, 121.7825], [24.55, 121.80], [24.7561, 121.7513], [24.95, 121.90], [25.05, 121.70], [25.0330, 121.5654]]
};

// Helper: Get full path between cities (Shortest path in circular sequence)
export const getRailwayPath = (startId: string, endId: string): [number, number][] => {
    const sequence = ['town_tpe', 'town_ntpc', 'town_tyn', 'town_txg', 'town_tnn', 'town_khh', 'town_pif', 'town_ttu', 'town_hun'];
    const n = sequence.length;
    const startIndex = sequence.indexOf(startId);
    const endIndex = sequence.indexOf(endId);
    if (startIndex === -1 || endIndex === -1) return [];

    // Calculate clockwise distance
    const cwDist = (endIndex - startIndex + n) % n;
    // Calculate counter-clockwise distance
    const ccwDist = (startIndex - endIndex + n) % n;

    const isCw = cwDist <= ccwDist;
    const steps: string[] = [];

    if (isCw) {
        let curr = startIndex;
        while (curr !== endIndex) {
            steps.push(sequence[curr]);
            curr = (curr + 1) % n;
        }
        steps.push(sequence[endIndex]);
    } else {
        let curr = startIndex;
        while (curr !== endIndex) {
            steps.push(sequence[curr]);
            curr = (curr - 1 + n) % n;
        }
        steps.push(sequence[endIndex]);
    }

    const path: [number, number][] = [];
    for (let i = 0; i < steps.length - 1; i++) {
        const s1 = steps[i];
        const s2 = steps[i + 1];

        // Try key s1-s2 then s2-s1
        let segment = RAILWAY_NETWORK[`${s1}-${s2}`];
        let reversed = false;
        if (!segment) {
            segment = RAILWAY_NETWORK[`${s2}-${s1}`];
            reversed = true;
        }

        if (segment) {
            const points = reversed ? [...segment].reverse() : segment;
            path.push(...(path.length > 0 ? points.slice(1) : points));
        }
    }
    return path;
};

export interface MapPOI {
    id: string;
    type: 'chest' | 'elite' | 'altar' | 'merchant';
    lat: number;
    lng: number;
    expiresAt?: number;
    lockedBy?: string | null;
    lockedAt?: number | null;
}

export const POI_NAMES: Record<string, string> = {
    chest: '遺落的物資',
    elite: '危險的魔物棲息地',
    altar: '神秘祭壇',
    merchant: '流浪商人'
};

export const POI_DETAILS = {
    merchant: {
        name: '流浪商人',
        icon: '👳‍♂️',
        frequency: '每整點、30分出現，持續 15 分鐘',
        effect: '可販售物品獲取金幣，並有 5% 機率贈送地區特產材料。'
    },
    chest: {
        name: '遺落的物資',
        icon: '📦',
        frequency: '地圖隨機生成',
        effect: '獲得隨等級提升的金幣，10% 機率得藥草×3，1% 機率得復甦精華。'
    },
    elite: {
        name: '魔物棲息地',
        icon: '👹',
        frequency: '地圖隨機生成',
        effect: '挑戰菁英魔物，勝利可獲得大量經驗值、金幣及稀有掉落物。'
    },
    altar: {
        name: '神秘祭壇',
        icon: '⛩️',
        frequency: '地圖隨機生成',
        effect: '立刻恢復勇者的生命值至 100% 狀態。'
    }
};

// Partners Data
export const PARTNER_POOL = [
    { name: '聖靈騎士', role: 'tank' as const, rarity: 5 as const, power: 80, avatar: '🧔' },
    { name: '精靈射手', role: 'dps' as const, rarity: 4 as const, power: 53, avatar: '🧝' },
    { name: '治癒修女', role: 'healer' as const, rarity: 4 as const, power: 43, avatar: '👩‍🦰' },
    { name: '鐵甲守衛', role: 'tank' as const, rarity: 3 as const, power: 27, avatar: '👨‍🦲' },
    { name: '見習法師', role: 'dps' as const, rarity: 3 as const, power: 20, avatar: '🧙' },
    { name: '流浪劍客', role: 'dps' as const, rarity: 3 as const, power: 18, avatar: '👨‍🦱' },
    { name: '暗影刺客', role: 'dps' as const, rarity: 5 as const, power: 55, avatar: '🕵️' },
    { name: '大地祭司', role: 'healer' as const, rarity: 4 as const, power: 30, avatar: '👳' },
];

export const getPartnerAvatar = (name: string, fallback: string) => {
    return PARTNER_POOL.find(p => p.name === name)?.avatar || fallback;
};
