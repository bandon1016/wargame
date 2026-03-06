import type { Building } from '../types/game';

type StaticBuilding = Omit<Building, 'level' | 'assignedPartners' | 'isUpgrading' | 'upgradeEndsAt'>;

export const BUILDING_DICT: Record<string, StaticBuilding> = {
    'b1': { id: 'b1', name: '資源工坊', type: 'material_camp', baseProduction: 100, upgradeCost: 1000, description: '自動產出家園建材', icon: '🧱' },
    'b2': { id: 'b2', name: '淘金礦場', type: 'gold_mine', baseProduction: 50, upgradeCost: 1200, description: '自動產出金幣', icon: '⛏️' },
    'b3': { id: 'b3', name: '神秘祭壇', type: 'altar', baseProduction: 0, upgradeCost: 2000, description: '提升角色修為', icon: '⛩️' },
    'b4': { id: 'b4', name: '鍛造廠', type: 'forge', baseProduction: 0, upgradeCost: 2500, description: '強化與鍛造裝備', icon: '⚒️' },
};
