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
}

export interface CharacterStats {
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
    skills: Skill[];
    partners: Partner[];
    buildings: Building[];
    equipment: Equipment[];
    equippedWeapon?: Equipment | null;
    equippedArmor?: Equipment | null;
    equippedHelmet?: Equipment | null;
    equippedBoots?: Equipment | null;
    equippedAccessory?: Equipment | null;
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
    { id: 'eq_dragon_slayer', name: '屠龍巨劍', slot: 'weapon', rarity: 5, attack: 55, defense: 0, hp: 0, icon: '🗡️', description: '傳說中曾斬下高階黑龍頭顱的巨劍' },
    { id: 'eq_leather_armor', name: '皮甲', slot: 'armor', rarity: 1, attack: 0, defense: 5, hp: 20, icon: '🧥', description: '簡易的皮革護甲' },
    { id: 'eq_chain_mail', name: '鎖子甲', slot: 'armor', rarity: 2, attack: 0, defense: 12, hp: 40, icon: '🛡️', description: '環環相扣的金屬鎧甲' },
    { id: 'eq_dragon_armor', name: '龍鱗鎧甲', slot: 'armor', rarity: 5, attack: 5, defense: 35, hp: 100, icon: '🐲', description: '以黑龍鱗片打造的傳說級鎧甲' },
    { id: 'eq_iron_helm', name: '鐵盔', slot: 'helmet', rarity: 2, attack: 0, defense: 8, hp: 15, icon: '⛑️', description: '保護頭部的鐵製頭盔' },
    { id: 'eq_crystal_crown', name: '水晶王冠', slot: 'helmet', rarity: 4, attack: 0, defense: 15, hp: 50, icon: '👑', description: '以花東水晶雕刻而成的魔法王冠' },
    { id: 'eq_leather_boots', name: '皮靴', slot: 'boots', rarity: 1, attack: 0, defense: 3, hp: 10, icon: '👢', description: '輕便的冒險者皮靴' },
    { id: 'eq_steel_greaves', name: '鋼鐵護腿', slot: 'boots', rarity: 3, attack: 0, defense: 10, hp: 20, icon: '🥾', description: '沉重但提供極佳防護的鋼製戰靴' },
    { id: 'eq_ruby_ring', name: '紅寶石戒指', slot: 'accessory', rarity: 3, attack: 10, defense: 5, hp: 30, icon: '💍', description: '鑲嵌紅寶石的魔法戒指' },
    { id: 'eq_pearl_necklace', name: '海淵珍珠項鍊', slot: 'accessory', rarity: 4, attack: 0, defense: 10, hp: 80, icon: '📿', description: '散發柔和水屬性魔力的珍貴項鍊' },
    { id: 'eq_iron_helm', name: '鍛鐵戰盔', slot: 'helmet', rarity: 2, attack: 0, defense: 10, hp: 20, icon: '⛑️', description: '新北鐵匠打造，堅固保護頭部' },
    { id: 'eq_iron_boots', name: '荒野皮靴', slot: 'boots', rarity: 2, attack: 0, defense: 6, hp: 15, icon: '🥾', description: '新北可用的堅牛探險靴' },
    { id: 'eq_mountain_sword', name: '山嶽大劍', slot: 'weapon', rarity: 3, attack: 22, defense: 2, hp: 0, icon: '⚔️', description: '台中山區鐵匠打造的巨型包括劍' },
    { id: 'eq_ironwood_shield', name: '神木防盾', slot: 'armor', rarity: 3, attack: 0, defense: 18, hp: 60, icon: '🛡️', description: '神木核心打造，山嶽氣息海浪不入' },
    { id: 'eq_sea_dagger', name: '南海尖牙匕首', slot: 'weapon', rarity: 3, attack: 18, defense: 0, hp: 0, icon: '🔪', description: '高雄港口珍珠匠打造，文如海鯢般經久' },
    { id: 'eq_dragon_greaves', name: '龍鱗護腿', slot: 'boots', rarity: 4, attack: 0, defense: 18, hp: 40, icon: '👢', description: '高雄專購，龍鱗鐵打造的進階戰靴' },
    { id: 'eq_coral_bracelet', name: '珊瑚護腕', slot: 'accessory', rarity: 3, attack: 5, defense: 8, hp: 50, icon: '🐚', description: '屏東海礁珊瑚打造，發出杯色輪小光芒' },
    { id: 'eq_basalt_armor', name: '玄武重甲', slot: 'armor', rarity: 3, attack: 0, defense: 22, hp: 50, icon: '🪨', description: '台東磐靈仔所打造，防禦准尤其凜個' },
    { id: 'eq_crystal_shuriken', name: '冰霜手裡劍', slot: 'weapon', rarity: 4, attack: 35, defense: 0, hp: 15, icon: '❄️', description: '以花東純淨水晶精雕而成的四角暗器，擲出時帶有刺骨的冰霜寒氣。' },
    // 相容性保留：eq_crystal_staff 已重命名為冰霜手裡劍，舊存檔照常顯示
    { id: 'eq_crystal_staff', name: '冰霜手裡劍', slot: 'weapon', rarity: 4, attack: 35, defense: 0, hp: 15, icon: '❄️', description: '以花東純淨水晶精雕而成的四角暗器，擲出時帶有刺骨的冰霜寒氣。' },
    { id: 'eq_crystal_robe', name: '水晶魔法袍', slot: 'armor', rarity: 4, attack: 10, defense: 20, hp: 80, icon: '👘', description: '花蓮魔法師援用，水晶繼維紡織而成' },
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
    {
        id: 'forge_iron_sword',
        targetEquipmentId: 'eq_iron_sword',
        materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }],
        goldCost: 200
    },
    {
        id: 'forge_steel_greaves',
        targetEquipmentId: 'eq_steel_greaves',
        materials: [
            { id: 'mat_central_iron', name: '高山鐵礦', quantity: 3 },
            { id: 'item_iron_ore', name: '鐵礦石', quantity: 10 }
        ],
        goldCost: 800
    },
    {
        id: 'forge_pearl_necklace',
        targetEquipmentId: 'eq_pearl_necklace',
        materials: [
            { id: 'mat_south_pearl', name: '海淵珍珠', quantity: 2 },
            { id: 'item_magic_gem', name: '魔力寶石', quantity: 3 }
        ],
        goldCost: 1500
    },
    {
        id: 'forge_dragon_armor',
        targetEquipmentId: 'eq_dragon_armor',
        materials: [
            { id: 'item_dragon_scale', name: '龍鱗碎片', quantity: 5 },
            { id: 'mat_central_iron', name: '高山鐵礦', quantity: 10 }
        ],
        goldCost: 5000
    },
    // City-exclusive recipes
    {
        id: 'forge_iron_helm', targetEquipmentId: 'eq_iron_helm', cityId: 'town_ntpc',
        materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 8 }], goldCost: 300
    },
    {
        id: 'forge_iron_boots', targetEquipmentId: 'eq_iron_boots', cityId: 'town_ntpc',
        materials: [{ id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }], goldCost: 150
    },
    {
        id: 'forge_mountain_sword', targetEquipmentId: 'eq_mountain_sword', cityId: 'town_txg',
        materials: [
            { id: 'mat_central_iron', name: '高山鐵礦', quantity: 5 },
            { id: 'mat_central_wood', name: '神木枝枒', quantity: 3 }
        ], goldCost: 1000
    },
    {
        id: 'forge_ironwood_shield', targetEquipmentId: 'eq_ironwood_shield', cityId: 'town_txg',
        materials: [
            { id: 'mat_central_wood', name: '神木枝枒', quantity: 5 },
            { id: 'item_iron_ore', name: '鐵礦石', quantity: 8 }
        ], goldCost: 900
    },
    {
        id: 'forge_sea_dagger', targetEquipmentId: 'eq_sea_dagger', cityId: 'town_khh',
        materials: [
            { id: 'mat_south_pearl', name: '海淵珍珠', quantity: 2 },
            { id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }
        ], goldCost: 1200
    },
    {
        id: 'forge_dragon_greaves', targetEquipmentId: 'eq_dragon_greaves', cityId: 'town_khh',
        materials: [
            { id: 'item_dragon_scale', name: '龍鱗碎片', quantity: 3 },
            { id: 'mat_central_iron', name: '高山鐵礦', quantity: 5 }
        ], goldCost: 2500
    },
    {
        id: 'forge_coral_bracelet', targetEquipmentId: 'eq_coral_bracelet', cityId: 'town_pif',
        materials: [
            { id: 'mat_coral', name: '珊瑚碎片', quantity: 4 },
            { id: 'mat_south_pearl', name: '海淵珍珠', quantity: 1 }
        ], goldCost: 1100
    },
    {
        id: 'forge_basalt_armor', targetEquipmentId: 'eq_basalt_armor', cityId: 'town_ttu',
        materials: [
            { id: 'mat_basalt', name: '玄武岩礦石', quantity: 5 },
            { id: 'item_iron_ore', name: '鐵礦石', quantity: 5 }
        ], goldCost: 1300
    },
    {
        id: 'forge_crystal_shuriken', targetEquipmentId: 'eq_crystal_shuriken', cityId: 'town_hun',
        materials: [
            { id: 'mat_east_crystal', name: '花東水晶', quantity: 4 },
            { id: 'item_magic_gem', name: '魔力寶石', quantity: 3 }
        ], goldCost: 3000
    },
    {
        id: 'forge_crystal_robe', targetEquipmentId: 'eq_crystal_robe', cityId: 'town_hun',
        materials: [
            { id: 'mat_east_crystal', name: '花東水晶', quantity: 5 },
            { id: 'mat_central_wood', name: '神木枝枒', quantity: 3 }
        ], goldCost: 3500
    },
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
    // East coast: high lng
    if (lng > 121.2 && lat > 22.5 && lat <= 24.5) return 'east';
    if (lat > 24.5) return 'north';
    if (lat > 23.5 && lat <= 24.5) return 'central';
    if (lat > 22.0 && lat <= 23.5) return 'south';
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
    facilities: ('market' | 'blacksmith' | 'alchemy' | 'station')[];
}

export const TOWN_DATABASE: Town[] = [
    { id: 'town_tpe', name: '台北城', lat: 25.0330, lng: 121.5654, radius: 2000, color: '#3b82f6', facilities: ['market', 'blacksmith', 'alchemy', 'station'] },
    { id: 'town_ntpc', name: '新北城', lat: 25.0169, lng: 121.4627, radius: 2000, color: '#6366f1', facilities: ['market', 'blacksmith', 'station'] },
    { id: 'town_tyn', name: '桃園城', lat: 24.9931, lng: 121.3010, radius: 2000, color: '#14b8a6', facilities: ['market', 'station'] },
    { id: 'town_txg', name: '台中城', lat: 24.1477, lng: 120.6736, radius: 2000, color: '#f59e0b', facilities: ['market', 'blacksmith', 'alchemy', 'station'] },
    { id: 'town_tnn', name: '台南城', lat: 22.9997, lng: 120.2270, radius: 2000, color: '#ef4444', facilities: ['market', 'alchemy', 'station'] },
    { id: 'town_khh', name: '高雄城', lat: 22.6272, lng: 120.3014, radius: 2000, color: '#eab308', facilities: ['market', 'blacksmith', 'alchemy', 'station'] },
    { id: 'town_pif', name: '屏東城', lat: 22.6685, lng: 120.4862, radius: 2000, color: '#f97316', facilities: ['market', 'blacksmith', 'station'] },
    { id: 'town_ttu', name: '台東城', lat: 22.7931, lng: 121.1248, radius: 2000, color: '#8b5cf6', facilities: ['market', 'blacksmith', 'station'] },
    { id: 'town_hun', name: '花蓮城', lat: 23.9936, lng: 121.5972, radius: 2000, color: '#ec4899', facilities: ['market', 'blacksmith', 'station'] }
];

export const RAILWAY_NETWORK: Record<string, [number, number][]> = {
    'town_tpe-town_ntpc': [[25.0330, 121.5654], [25.0169, 121.4627]],
    'town_ntpc-town_tyn': [[25.0169, 121.4627], [24.9931, 121.3010]],
    'town_tyn-town_txg': [[24.9931, 121.3010], [24.8138, 120.9675], [24.5601, 120.8209], [24.1477, 120.6736]],
    'town_txg-town_tnn': [[24.1477, 120.6736], [23.4791, 120.4497], [22.9997, 120.2270]],
    'town_tnn-town_khh': [[22.9997, 120.2270], [22.6272, 120.3014]],
    'town_khh-town_pif': [[22.6272, 120.3014], [22.6685, 120.4862]],
    'town_pif-town_ttu': [[22.6685, 120.4862], [22.3688, 120.6276], [22.1812, 120.8752], [22.7931, 121.1248]],
    'town_ttu-town_hun': [[22.7931, 121.1248], [23.1092, 121.3789], [23.4795, 121.4673], [23.9936, 121.5972]],
    'town_hun-town_tpe': [[23.9936, 121.5972], [24.4025, 121.7825], [24.7561, 121.7513], [25.0330, 121.5654]]
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
