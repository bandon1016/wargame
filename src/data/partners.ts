import type { Partner } from '../types/game';

type StaticPartner = Omit<Partner, 'level' | 'exp' | 'maxExp'>;

export const PARTNER_DICT: Record<string, StaticPartner> = {
    'p_saint_knight': { id: 'p_saint_knight', name: '聖靈騎士', role: 'tank', rarity: 5, power: 80, avatar: '🧔' },
    'p_shadow_assassin': { id: 'p_shadow_assassin', name: '暗影刺客', role: 'dps', rarity: 5, power: 55, avatar: '🕵️' },
    'p_fairy_medic': { id: 'p_fairy_medic', name: '仙境藥師', role: 'healer', rarity: 5, power: 70, avatar: '🧚' },
    'p_elf_archer': { id: 'p_elf_archer', name: '精靈射手', role: 'dps', rarity: 4, power: 53, avatar: '🧝' },
    'p_healer_sister': { id: 'p_healer_sister', name: '治癒修女', role: 'healer', rarity: 4, power: 43, avatar: '👩‍🦰' },
    'p_earth_priest': { id: 'p_earth_priest', name: '大地祭司', role: 'healer', rarity: 4, power: 30, avatar: '👳' },
    'p_iron_guard': { id: 'p_iron_guard', name: '鐵甲守衛', role: 'tank', rarity: 3, power: 27, avatar: '👨‍🦲' },
    'p_apprentice_mage': { id: 'p_apprentice_mage', name: '見習法師', role: 'dps', rarity: 3, power: 20, avatar: '🧙' },
    'p_wanderer_swordsman': { id: 'p_wanderer_swordsman', name: '流浪劍客', role: 'dps', rarity: 3, power: 18, avatar: '👨‍🦱' },
};
