import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Sword, Home, Users, Package, Settings as SettingsIcon, Book, Heart, Shield, Zap, ChevronRight, ChevronLeft, MapPin, Loader2, X, PlusCircle, ShieldAlert, TrainFront, Coins, Sparkles, Cpu, Waves, Diamond, Trophy, Copy, Check, ScrollText, TrendingUp, Square } from 'lucide-react';
import type { CharacterStats, Equipment, GameItem, Skill, MapPOI, Town, WeatherType, Enemy, AlchemyRecipe, BlacksmithRecipe, ElementType } from './types/game';
import { MONSTER_DATABASE, SKILL_DATABASE, ITEM_DATABASE, EQUIPMENT_DATABASE, RARITY_COLORS, WEATHER_TYPES, TOWN_DATABASE, getPartnerAvatar, getRailwayPath, POI_NAMES, ELEMENT_META, getRegionByCoordinates, getRegionByCityName, getRegionalMaterials } from './types/game';
import { UPDATE_NOTES } from './data/updates';
import { CombatScreen } from './components/CombatScreen';
import { PartnersTab } from './components/PartnersTab';
import { HomeTab } from './components/HomeTab';
import { AuthScreen } from './components/AuthScreen';
import { TownScreen } from './components/TownScreen';
import { GuideModal } from './components/GuideModal';
import RankingTab from './components/RankingTab';
import { WeatherRain } from './components/WeatherRain';
import { DailyQuestPanel } from './components/DailyQuestPanel';
import { supabase } from './lib/supabase';

// Fix leaflet default icon paths in React
import L from 'leaflet';
import iconImg from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: iconImg, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

// Custom Player Icon (Avatar Emoji)
const createPlayerIcon = (emoji: string, godAvatar: string | null = null) => L.divIcon({
  html: `
  <div class="relative flex items-center justify-center">
    ${godAvatar ? `
        <div class="absolute -top-3 -right-3 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center border-2 border-black shadow-[0_0_10px_rgba(251,191,36,0.5)] z-20 anim-god-glow">
          <span class="text-sm">${godAvatar}</span>
        </div>
        <div class="absolute inset-0 w-12 h-12 -m-1 bg-amber-400/20 rounded-full anim-god-aura blur-[2px] border border-amber-500/30"></div>
      ` : ''
    }
<div class="relative text-3xl drop-shadow-lg ${godAvatar ? 'anim-god-glow' : ''}">${emoji}</div>
    </div >
  `,
  className: 'player-div-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const POI_ICONS = {
  chest: '📦',
  merchant: '👳‍♂️',
  elite: '👹',
  altar: '⛩️'
};
const createPoiIcon = (type: keyof typeof POI_ICONS) => L.divIcon({
  html: `<div style="font-size: 24px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.7)); transform: translate(-10%, -10%); opacity: 0.9;">${POI_ICONS[type]}</div>`,
  className: 'custom-poi-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const FACILITY_ICONS: Record<string, string> = {
  shipyard: '⛴️',
  dock: '⚓',
};
const createFacilityIcon = (type: string, label: string) => L.divIcon({
  html: `
  <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
    <div style="font-size:22px; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.8));">${FACILITY_ICONS[type] || '🏛️'}</div>
    <div style="font-size:9px; font-weight:900; color:#93c5fd; background:rgba(0,0,0,0.75); border:1px solid rgba(255,255,255,0.15); padding:1px 5px; border-radius:99px; white-space:nowrap; backdrop-filter:blur(4px);">${label}</div>
  </div>`,
  className: 'facility-static-marker',
  iconSize: [50, 42],
  iconAnchor: [25, 42],
});

const createCityLabelIcon = (name: string) => L.divIcon({
  html: `
  <div class="flex flex-col items-center">
    <div class="px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black text-white shadow-xl shadow-black/50 whitespace-nowrap">
      ${name}
    </div>
    </div >
  `,
  className: 'city-label-icon',
  iconSize: [60, 20],
  iconAnchor: [30, -5]
});

const createConfirmIcon = (label: string) => L.divIcon({
  html: `
  <div class="relative flex flex-col items-center group pointer-events-auto">
      <!-- Floating Card Confirm UI -->
      <div class="absolute bottom-10 flex flex-col items-center anim-fade-in-up">
        <div class="bg-black/95 backdrop-blur-2xl border border-game-accent/50 rounded-2xl p-2 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2 min-w-[150px]">
          <div class="text-[13px] font-black text-game-accent uppercase tracking-wide mb-1 opacity-90">${label}</div>
          <div class="flex gap-1.5 w-full">
            <button id="btn-confirm-move" class="flex-1 bg-game-accent hover:bg-white hover:text-game-accent text-white py-2 px-3 rounded-xl font-black text-[11px] transition-all active:scale-90 shadow-lg shadow-game-accent/30 flex items-center justify-center gap-1.5">
              🚀 出發
            </button>
            <button id="btn-cancel-move" class="w-9 h-9 bg-white/10 hover:bg-white/20 text-gray-400 rounded-xl flex items-center justify-center transition-all active:scale-90 border border-white/5">
              ✕
            </button>
          </div>
        </div>
        <!-- Arrow -->
        <div class="w-3.5 h-3.5 bg-black/95 rotate-45 border-r border-b border-game-accent/50 -mt-2"></div>
      </div>
      <!--Pin -->
  <div class="text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] anim-pulse-slow">📍</div>
    </div >
  `,
  className: 'target-confirm-icon pointer-events-auto',
  iconSize: [40, 40],
  iconAnchor: [20, 30]
});

const TARGET_ICON_SIMPLE = L.divIcon({
  html: '<div class="text-2xl anim-pulse">📍</div>',
  className: 'reached-pin',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

interface SessionStats {
  exp: number;
  gold: number;
  kills: number;
  eliteKills: number;
  partnerExp: number;
  incense: number;
  items: Record<string, { id: string; name: string; icon: string; quantity: number }>;
}

function MapUpdater({ center, isTraveling, weather }: { center: [number, number], isTraveling: boolean, weather: WeatherType }) {
  const map = useMap();
  const lastCenterRef = React.useRef<[number, number] | null>(null);

  useEffect(() => {
    if (weather === 'foggy') {
      map.setZoom(16); // Foggy fixed zoom
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      if (map.zoomControl) {
        // map.zoomControl.remove(); // This is harder to toggle, better just rely on CSS or props
      }
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();

      if (isTraveling) {
        map.setZoom(11); // County level zoom
      } else {
        map.setZoom(15); // Street/City level zoom
      }
    }
  }, [isTraveling, weather, map]);

  useEffect(() => {
    // Only setView if center changed significantly or is first run
    // This avoids sub-pixel jitter during smooth movement
    const threshold = 0.000001;
    const latDiff = lastCenterRef.current ? Math.abs(center[0] - lastCenterRef.current[0]) : 1;
    const lngDiff = lastCenterRef.current ? Math.abs(center[1] - lastCenterRef.current[1]) : 1;

    if (latDiff > threshold || lngDiff > threshold) {
      if (weather === 'foggy') {
        map.setView(center, 16, { animate: true });
      } else {
        map.setView(center, map.getZoom(), { animate: false });
      }
      lastCenterRef.current = center;
    }
  }, [center, weather, map]);
  return null;
}

/* ─── Helpers ─── */
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const r1 = lat1 * Math.PI / 180;
  const r2 = lat2 * Math.PI / 180;
  const dr = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dr / 2) * Math.sin(dr / 2) + Math.cos(r1) * Math.cos(r2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ─── Fixed Rewards by Level (Authoritative Helper) ───
const getRewardsByLevel = (lv: number) => ({
  exp: 15 + (lv - 1) * 10,
  gold: 10 + (lv - 1) * 5
});

// --- God System Stat Bonuses ---
const getGodStatBonus = (p: CharacterStats) => {
  if (!p.activeGodId) return { atk: 1, def: 1, hp: 1, dmg: 1 };
  const god = p.gods.find(g => g.id === p.activeGodId);
  if (!god) return { atk: 1, def: 1, hp: 1, dmg: 1 };

  const lv = god.level;
  if (god.name.includes('媽祖')) return { atk: 1, def: 1 + lv * 0.005, hp: 1, dmg: 1 };
  if (god.name.includes('土地公')) return { atk: 1, def: 1, hp: 1 + lv * 0.005, dmg: 1 };
  if (god.name.includes('太子')) return { atk: 1 + lv * 0.005, def: 1, hp: 1, dmg: 1 };
  if (god.name.includes('玄天')) return { atk: 1, def: 1, hp: 1, dmg: 1 + lv * 0.01 };
  if (god.name.includes('關公') || god.name.includes('關聖')) return { atk: 1 + lv * 0.01, def: 1 + lv * 0.01, hp: 1 + lv * 0.01, dmg: 1 };

  return { atk: 1, def: 1, hp: 1, dmg: 1 };
};

const totalEquipAtk = (p: CharacterStats) => [p.equippedWeapon, p.equippedArmor, p.equippedHelmet, p.equippedBoots, p.equippedAccessory].reduce((s, e) => s + (e?.attack ?? 0), 0);
const totalEquipDef = (p: CharacterStats) => [p.equippedWeapon, p.equippedArmor, p.equippedHelmet, p.equippedBoots, p.equippedAccessory].reduce((s, e) => s + (e?.defense ?? 0), 0);
const totalEquipHp = (p: CharacterStats) => [p.equippedWeapon, p.equippedArmor, p.equippedHelmet, p.equippedBoots, p.equippedAccessory].reduce((s, e) => s + (e?.hp ?? 0), 0);

// Partner Stat Bonuses (Only counts deployed partners)
const totalPartnerAtk = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'dps' ? pt.power : Math.floor(pt.power * 0.2)), 0);
const totalPartnerDef = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'tank' ? Math.floor(pt.power * 0.5) : Math.floor(pt.power * 0.1)), 0);
const totalPartnerHp = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'tank' || pt.role === 'healer' ? pt.power * 3 : pt.power), 0);
const totalPartnerHeal = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'healer' ? pt.power : 0), 0);

// Authoritative Effective Stats (Base + Equip + Partner) * God Bonus
const getEffectiveAtk = (p: CharacterStats) => Math.floor((p.attack + totalEquipAtk(p) + totalPartnerAtk(p)) * getGodStatBonus(p).atk);
const getEffectiveDef = (p: CharacterStats) => Math.floor((p.defense + totalEquipDef(p) + totalPartnerDef(p)) * getGodStatBonus(p).def);
const getEffectiveMaxHp = (p: CharacterStats) => Math.floor((p.maxHp + totalEquipHp(p) + totalPartnerHp(p)) * getGodStatBonus(p).hp);

export const getSkillUpgradeInfo = (currentLevel: number) => {
  if (currentLevel >= 10) return null;
  const targetLv = currentLevel + 1;
  const fragCost = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
  const goldCost = [0, 1000, 2000, 3000, 5000, 8000, 13000, 21000, 34000, 55000];

  const fragments = fragCost[currentLevel] || 55;
  const gold = goldCost[currentLevel] || 55000;

  let successRate = 100;
  if (targetLv === 5) successRate = 70;
  else if (targetLv === 6) successRate = 60;
  else if (targetLv === 7) successRate = 50;
  else if (targetLv === 8) successRate = 40;
  else if (targetLv === 9) successRate = 15;
  else if (targetLv === 10) successRate = 10;

  return { fragments, gold, successRate };
};

interface CombatLog {
  id: string;
  type: 'win' | 'lose' | 'info';
  enemyName: string;
  exp?: number;
  gold?: number;
  partnerExp?: number;
  items?: { name: string; quantity: number; icon: string }[];
  message?: string;
}

const DEFAULT_POSITION: [number, number] = [25.0340, 121.5645]; // 台北101

// 多邊形定點 (Lat, Lng)：貼齊台灣本島海岸線並預留少許海灘緩衝區
const TAIWAN_MAIN_ISLAND_POLYGON = [
  [25.50, 121.40], // 北海岸 (加大多一點避免北海岸被切到)
  [25.20, 122.10], // 東北角
  [24.50, 122.00], // 宜花交界
  [22.70, 121.40], // 台東
  [21.80, 121.00], // 鵝鑾鼻
  [21.80, 120.50], // 貓鼻頭
  [22.50, 120.10], // 高雄
  [23.10, 119.90], // 台南
  [23.80, 119.90], // 雲林
  [24.40, 120.20], // 台中
  [24.90, 120.70], // 新竹
  [25.20, 120.90]  // 桃園
];

// 澎湖群島粗略方塊
const isInPenghu = (lat: number, lng: number) => lat >= 23.1 && lat <= 23.9 && lng >= 119.3 && lng <= 119.8;

// 小琉球與綠島蘭嶼補償方塊 (簡單涵蓋)
const isExternalIslands = (lat: number, lng: number) =>
  (lat >= 22.3 && lat <= 22.4 && lng >= 120.3 && lng <= 120.4) || // 小琉球
  (lat >= 21.9 && lat <= 22.7 && lng >= 121.4 && lng <= 121.6); // 綠島蘭嶼

// 射線交叉法 (Ray-casting algorithm) 判斷點是否在多邊形內
const isPointInPolygon = (lat: number, lng: number, polygon: number[][]) => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lng) !== (yj > lng))
      && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
};

const isInTaiwan = (lat: number, lng: number) => {
  return isPointInPolygon(lat, lng, TAIWAN_MAIN_ISLAND_POLYGON) || isInPenghu(lat, lng) || isExternalIslands(lat, lng);
};

const App: React.FC = () => {
  const [position, setPosition] = useState<[number, number]>([25.0330, 121.5654]);
  const positionRef = React.useRef<[number, number]>(position);
  const [activeTab, setActiveTab] = useState('explore');
  const [isCombatMinimized, setIsCombatMinimized] = useState(false);
  const [initialFacility, setInitialFacility] = useState<'shipyard' | 'dock' | null>(null);

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [player, setPlayer] = useState<CharacterStats | null>(null);
  const playerRef = React.useRef<CharacterStats | null>(player);
  useEffect(() => { playerRef.current = player; }, [player]);

  const [weather, setWeather] = useState<WeatherType>('sunny');
  const weatherRef = React.useRef<WeatherType>(weather);
  const [areaName, setAreaName] = useState('載入中...');

  const [inTown, setInTown] = useState<Town | null>(null);
  const [pois, setPois] = useState<MapPOI[]>([]);
  const [targetPosition, setTargetPosition] = useState<[number, number] | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const moveDirRef = React.useRef<'n' | 's' | 'e' | 'w' | null>(null);

  // Walking persistence refs
  const walkTargetRef = React.useRef<[number, number] | null>(null);
  const walkStartRef = React.useRef<[number, number] | null>(null);
  const walkStartedAtRef = React.useRef<Date | null>(null);
  const walkDurationSecRef = React.useRef<number>(0);
  const lastSafePositionRef = React.useRef<[number, number]>([25.0330, 121.5654]); // 紀錄最後在陸地的安全座標
  const [lootMessage, setLootMessage] = useState<{ title: string; items: { name: string; quantity: number; icon: string }[]; gold?: number; exp?: number } | null>(null);

  const [activePoiCombat, setActivePoiCombat] = useState<string | null>(null);
  const [batchUseItem, setBatchUseItem] = useState<GameItem | null>(null);
  const [batchAmount, setBatchAmount] = useState<number>(1);
  const [pendingTarget, setPendingTarget] = useState<{ lat: number, lng: number, label: string } | null>(null);
  const [isMerchantOpen, setIsMerchantOpen] = useState(false);
  const [isWeatherPanelOpen, setIsWeatherPanelOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [isDoubleTabbed, setIsDoubleTabbed] = useState(false);
  const isDoubleTabbedRef = React.useRef(isDoubleTabbed);
  const isRpcPendingRef = React.useRef(false); // New flag to block auto-save during RPCs
  useEffect(() => { isDoubleTabbedRef.current = isDoubleTabbed; }, [isDoubleTabbed]);
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);

  // --- Map Style Switcher State ---
  const [mapStyle, setMapStyle] = useState(() => {
    return localStorage.getItem('war_game_map_style') || '自動變化';
  });
  useEffect(() => {
    localStorage.setItem('war_game_map_style', mapStyle);
  }, [mapStyle]);

  const [mySessionId] = useState(() => crypto.randomUUID());
  const activePoiRef = React.useRef<string | null>(null);
  const activeMerchantPoiRef = React.useRef<string | null>(null);
  const eliteCooldownsRef = React.useRef<Record<string, number>>({});
  const lastDismissedIdRef = React.useRef<string | null>(null);
  const [interactingLocation, setInteractingLocation] = useState<{ type: 'town', town: Town } | { type: 'poi', poi: MapPOI } | null>(null);

  useEffect(() => { activePoiRef.current = activePoiCombat; }, [activePoiCombat]);

  const [combatLogs, setCombatLogs] = useState<CombatLog[]>([]);
  const [forgingRecipeId, setForgingRecipeId] = useState<string | null>(null);
  const [logOpacity, setLogOpacity] = useState(1);
  const [isLogsExpanded, setIsLogsExpanded] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [showTreasury, setShowTreasury] = useState(false);

  // --- Session Stats Logic ---
  const [isStatsView, setIsStatsView] = useState(false);
  const [hasQuestReward, setHasQuestReward] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    exp: 0, gold: 0, kills: 0, eliteKills: 0, partnerExp: 0, incense: 0, items: {}
  });

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Check for onboarding
  useEffect(() => {
    if (player && player.level === 1 && player.exp === 0) {
      const hasSeen = localStorage.getItem('hasSeenOnboarding_v1');
      if (!hasSeen) {
        setShowOnboarding(true);
      }
    }
  }, [player]);

  const handleCloseOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding_v1', 'true');
    setShowOnboarding(false);
  };

  // Railway Travel States (Time-Based)
  const [isTraveling, setIsTraveling] = useState(false);
  const isTravelingRef = React.useRef(isTraveling);
  useEffect(() => { isTravelingRef.current = isTraveling; }, [isTraveling]);
  const [travelPath, setTravelPath] = useState<[number, number][]>([]);
  const [travelDepartedAt, setTravelDepartedAt] = useState<Date | null>(null);
  const [travelDurationSec, setTravelDurationSec] = useState(0);
  // Keep travelProgress for progress bar display only
  const [travelProgress, setTravelProgress] = useState(0);

  // Refs for animation loop to access travel state without stale closures
  const travelPathRef = React.useRef<[number, number][]>([]);
  const travelDepartedAtRef = React.useRef<Date | null>(null);
  const travelDurationSecRef = React.useRef<number>(0);

  useEffect(() => { travelPathRef.current = travelPath; }, [travelPath]);
  useEffect(() => { travelDepartedAtRef.current = travelDepartedAt; }, [travelDepartedAt]);
  useEffect(() => { travelDurationSecRef.current = travelDurationSec; }, [travelDurationSec]);

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  // Ref to saveProfile - avoids forward-reference issues since saveProfile is declared later via useCallback
  const saveProfileRef = React.useRef<((newState?: CharacterStats, forceLocation?: [number, number]) => Promise<void>) | null>(null);

  // Railway Animation Loop (Time-Based - cross-device safe)
  useEffect(() => {
    if (!isTraveling) return;

    let frameId: number;

    const animate = () => {
      const path = travelPathRef.current;
      const departedAt = travelDepartedAtRef.current;
      const durationSec = travelDurationSecRef.current;

      if (!departedAt || path.length < 2 || durationSec <= 0) {
        frameId = requestAnimationFrame(animate);
        return;
      }

      const elapsedSec = (Date.now() - departedAt.getTime()) / 1000;
      const progress = Math.min(elapsedSec / durationSec, 1);
      setTravelProgress(progress);

      if (progress >= 1) {
        // Arrived! Clear REFS first so saveProfile reads null travel data (not stale closure)
        travelPathRef.current = [];
        travelDepartedAtRef.current = null;
        travelDurationSecRef.current = 0;

        const finalPos = path[path.length - 1];
        setPosition(finalPos);
        setIsTraveling(false);
        setTravelPath([]);
        setTravelDepartedAt(null);
        setTravelDurationSec(0);
        setTravelProgress(0);

        // Trigger immediate save to sync the arrival position and clear travel data in DB
        setTimeout(() => saveProfileRef.current?.(undefined, finalPos), 50);
        return;
      }

      // Interpolate position along path
      const totalSegments = path.length - 1;
      const rawIndex = progress * totalSegments;
      const segmentIndex = Math.floor(rawIndex);
      const segmentProgress = rawIndex - segmentIndex;
      const p1 = path[Math.min(segmentIndex, path.length - 2)];
      const p2 = path[Math.min(segmentIndex + 1, path.length - 1)];

      const lat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
      const lng = p1[1] + (p2[1] - p1[1]) * segmentProgress;
      setPosition([lat, lng]);

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isTraveling]);

  useEffect(() => {
    positionRef.current = position;

    // Reverse Geocoding for Area Name
    const updateAreaName = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position[0]}&lon=${position[1]}&zoom=10&addressdetails=1`, {
          headers: { 'Accept-Language': 'zh-TW' }
        });
        const data = await res.json();

        let city = '未知海域';
        if (data && data.address) {
          city = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || '未知海域';
        }

        if (city === '未知海域' || (data && data.error)) {
          // Player hit the ocean! Bounce back to last safe land
          setPosition(lastSafePositionRef.current);
          setTargetPosition(null);
          setIsWalking(false);
          walkTargetRef.current = null;
          walkStartRef.current = null;
          walkStartedAtRef.current = null;
          moveDirRef.current = null;
          // Notice: We don't change areaName here, we just bounced them back.
          setTimeout(() => saveProfileRef.current?.(), 0);
        } else {
          setAreaName(city);
          lastSafePositionRef.current = position;
        }
      } catch (e) {
        console.error("Geocoding error:", e);
      }
    };

    // Debounce geocoding during travel
    const timer = setTimeout(updateAreaName, isTraveling ? 2000 : 500);
    return () => clearTimeout(timer);
  }, [position, isTraveling]);

  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  // Generates POIs around the player via Database
  const fetchPois = useCallback(async () => {
    if (!session?.user?.id || isDoubleTabbedRef.current) return;
    const { data, error } = await supabase.rpc('sync_pois', {
      center_lat: positionRef.current[0],
      center_lng: positionRef.current[1]
    });

    if (error) {
      console.error('Error fetching POIs:', error);
      return;
    }

    if (data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        type: d.type,
        lat: d.lat,
        lng: d.lng,
        expiresAt: d.expires_at ? new Date(d.expires_at).getTime() : undefined,
        lockedBy: d.locked_by,
        lockedAt: d.locked_at ? new Date(d.locked_at).getTime() : undefined
      }));
      setPois(mapped);
    }
  }, [session]);

  useEffect(() => {
    fetchPois();
    const poiGenerator = setInterval(fetchPois, 60000); // 1 min heart-beat
    return () => clearInterval(poiGenerator);
  }, [fetchPois]);

  // Reactive POI fetching: update when movement ends or significant distance moved
  const lastFetchedPosRef = React.useRef<[number, number] | null>(null);
  useEffect(() => {
    if (isTraveling || isWalking) return;

    // Check distance from last fetch
    const lastPos = lastFetchedPosRef.current;
    const dist = lastPos ? Math.hypot(position[0] - lastPos[0], position[1] - lastPos[1]) : 999;

    // Distance-based quest progress (approx 1 unit = 111km, so 0.0001 = 11.1m)
    if (dist > 0.00001 && session?.user?.id) {
      const meters = Math.floor(dist * 111000);
      if (meters > 0) {
        supabase.rpc('increment_walk_quests', {
          p_user_id: session.user.id,
          p_increment_meters: meters
        }).then();
      }
    }

    if (dist > 0.01) { // Approx 1km movement
      fetchPois();
      lastFetchedPosRef.current = position;
    }
  }, [position, isTraveling, isWalking, fetchPois, session]);



  // Weather Logic: Deterministic Global Sync (Changes every 10 mins)
  const [weatherCountdown, setWeatherCountdown] = useState<string>('');
  const [nextWeather, setNextWeather] = useState<WeatherType | null>(null);

  useEffect(() => {
    const syncWeather = () => {
      const WEATHER_CYCLE_MS = 10 * 60 * 1000;
      const now = Date.now();
      const slot = Math.floor(now / WEATHER_CYCLE_MS);

      const pool: WeatherType[] = [
        'sunny', 'sunny', 'sunny', 'sunny', // 4/8 Sunny
        'rainy', 'rainy',                   // 2/8 Rainy
        'foggy',                             // 1/8 Foggy
        'stormy'                             // 1/8 Stormy
      ];

      const index = (slot * 31337) % pool.length;
      const newWeather = pool[index] as WeatherType;

      const nextSlot = slot + 1;
      const nextIndex = (nextSlot * 31337) % pool.length;
      const computedNextWeather = pool[nextIndex] as WeatherType;

      setWeather(prev => {
        if (prev !== newWeather) {
          console.log(`Weather Changing: ${prev} -> ${newWeather}`);
        }
        return newWeather;
      });
      setNextWeather(computedNextWeather);

      // Calculate countdown
      const msLeft = WEATHER_CYCLE_MS - (now % WEATHER_CYCLE_MS);
      const mins = Math.floor(msLeft / 60000);
      const secs = Math.floor((msLeft % 60000) / 1000);
      setWeatherCountdown(`${mins}分 ${secs}秒`);
    };

    syncWeather();
    const timer = setInterval(syncWeather, 1000); // Update countdown every second
    return () => clearInterval(timer);
  }, []);

  // Auth flow
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setPlayer(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Anti Double Tabbing
  useEffect(() => {
    if (!session?.user?.id) return;
    const channelName = 'war_game_channel_' + session.user.id;
    const channel = new BroadcastChannel(channelName);

    // Send initial ping to tell others I am the new active tab
    const timer = setTimeout(() => {
      channel.postMessage({ type: 'NEW_SESSION', sessionId: mySessionId });
    }, 100);

    const listener = (event: MessageEvent) => {
      if (event.data.type === 'NEW_SESSION' && event.data.sessionId !== mySessionId) {
        // A newer tab was opened! We are the old tab.
        setIsDoubleTabbed(true);
      }
    };

    channel.onmessage = listener;

    return () => {
      clearTimeout(timer);
      channel.close();
    };
  }, [session?.user?.id, mySessionId]);



  // Authoritative State Mapper: Maps DB profile fields to React state fields
  const checkQuestStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase.rpc('get_or_reset_daily_quests', {
        p_user_id: session.user.id
      });
      if (data) {
        setHasQuestReward((data as any[]).some(q => q.progress >= q.required && !q.claimed));
      }
    } catch (err) {
      console.error('Failed to check quest status:', err);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session) {
      checkQuestStatus();
      const interval = setInterval(checkQuestStatus, 5 * 60 * 1000); // 5 min
      return () => clearInterval(interval);
    }
  }, [session, checkQuestStatus]);

  // Authoritative State Mapper: Maps DB profile fields to React state fields
  const mapServerProfile = useCallback((data: any) => {
    return {
      ...data,
      id: data.id,
      nickname: data.nickname,
      level: data.level,
      hp: data.hp,
      maxHp: data.max_hp,
      mp: data.mp,
      maxMp: data.max_mp,
      exp: data.exp,
      maxExp: data.max_exp,
      gold: data.gold,
      baseMaterials: data.base_materials ?? 0,
      lingQi: data.ling_qi ?? 0,
      techFragments: data.tech_fragments ?? 0,
      incense: data.incense ?? 0,
      saltCrystals: data.salt_crystals ?? 0,
      premiumGems: data.premium_gems ?? 0,
      buildings: data.buildings || [],
      items: (data.items || []).map((it: any) => {
        const dbItem = ITEM_DATABASE.find(d => d.id === it.id);
        return {
          ...it,
          name: dbItem?.name || it.name || '未知道具',
          type: dbItem?.type || it.type || 'material',
          description: dbItem?.description || it.description || '探險獲得的道具',
          icon: dbItem?.icon || it.icon || '🧪'
        };
      }),
      equipment: data.equipment || [],
      partners: data.partners || [],
      equippedWeapon: data.equipped_weapon,
      equippedArmor: data.equipped_armor,
      equippedHelmet: data.equipped_helmet,
      equippedBoots: data.equipped_boots,
      equippedAccessory: data.equipped_accessory,
      skills: (data.skills || []).map((s: any) => ({
        id: s.id,
        level: s.level ?? 1,
        fragments: s.fragments ?? 0
      })),
      gods: data.gods || [],
      activeGodId: data.active_god_id,
      quests: Array.isArray(data.quests) ? data.quests : [],
      uid: data.uid || data.uid_12_code || 'G-0000',
      updatedAt: data.updated_at ? Math.floor(new Date(data.updated_at).getTime()) : Math.floor(Date.now())
    };
  }, []);

  // Realtime Sync for multi-browser support
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`profile_realtime_${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const data = payload.new;
          console.log("DEBUG: Received Profile Update", { dbSession: data.session_id, mySession: mySessionId });

          // SERVER SIDE ANTI DOUBLE TAB: If session_id in DB is different from ours, block this tab.
          if (data.session_id && data.session_id !== mySessionId) {
            console.warn("DOUBLE TAB DETECTED! Blocking access.");
            setIsDoubleTabbed(true);
            return;
          }

          // Authoritative Versioning: Only update state if server data is NEWER than current frontend state
          const serverUpdatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
          const currentUpdatedAt = playerRef.current?.updatedAt || 0;

          if (serverUpdatedAt > currentUpdatedAt) {
            console.log("DEBUG: Applying newer profile data from server", { serverUpdatedAt, currentUpdatedAt });
            setPlayer(mapServerProfile(data));
          } else {
            console.log("DEBUG: Ignored stale/current profile update from realtime", { serverUpdatedAt, currentUpdatedAt });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, mySessionId, mapServerProfile]);



  const fetchProfile = async (userId: string, silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setPlayer(mapServerProfile(data));

      // NEW TAB WINS: Claim the session for ourself unconditionally (only if not a silent background sync)
      if (!silent) {
        const { error: sessionError } = await supabase.from('profiles').update({ session_id: mySessionId }).eq('id', userId);
        if (sessionError) {
          console.error("Failed to claim session:", sessionError);
        }
      }

      // Load saved position
      if (data.current_location_lat === 25.0330 && data.current_location_lng === 121.5654 && data.level === 1) {
        // 新角色，嘗試使用 GPS
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              if (isInTaiwan(latitude, longitude)) {
                setPosition([latitude, longitude]);
              } else {
                setPosition(DEFAULT_POSITION);
              }
            },
            () => setPosition(DEFAULT_POSITION),
            { timeout: 5000, enableHighAccuracy: false }
          );
        } else {
          setPosition(DEFAULT_POSITION);
        }
      } else if (data.current_location_lat != null && data.current_location_lng != null) {
        setPosition([data.current_location_lat, data.current_location_lng]);
      }
      // Immediate fetch after profile load
      setTimeout(fetchPois, 100);
    } else if (error) {
      console.error('Fetch profile error:', error);
    }

    // Speed calculation helper for restoration
    const getCurrentSpeedPerSec = () => {
      // Calculate weather (deterministic)
      const pool: WeatherType[] = ['sunny', 'sunny', 'sunny', 'sunny', 'rainy', 'rainy', 'foggy', 'stormy'];
      const WEATHER_CYCLE_MS = 10 * 60 * 1000;
      const slot = Math.floor(Date.now() / WEATHER_CYCLE_MS);
      const currentWType = pool[(slot * 31337) % pool.length];

      // Check resistance if god is present
      const activeGodId = data.active_god_id;
      const gods = data.gods || [];
      const activeGodObj = activeGodId ? gods.find((g: any) => g.id === activeGodId) : null;
      const hasResist = activeGodObj && (activeGodObj.resistanceType === currentWType || activeGodObj.resistanceType === 'all');

      const wMod = hasResist ? (currentWType === 'sunny' ? 1.1 : 1.0) : (WEATHER_TYPES[currentWType]?.walkSpeedMod || 1.0);
      return 0.0048 * wMod;
    };

    // Restore walk state from DB if present
    if (data && data.walk_target_lat != null && data.walk_target_lng != null && data.walk_started_at && data.walk_start_lat != null && data.walk_start_lng != null && !data.travel_path) {
      const targetLat: number = data.walk_target_lat;
      const targetLng: number = data.walk_target_lng;
      const startLat: number = data.walk_start_lat;
      const startLng: number = data.walk_start_lng;
      const startedAt = new Date(data.walk_started_at);
      const elapsedSec = (Date.now() - startedAt.getTime()) / 1000;

      const dLat = targetLat - startLat;
      const dLng = targetLng - startLng;
      const dist = Math.hypot(dLat, dLng);
      // Use duration from server or fall-back to calculating it once
      const durationSec = (data.walk_duration_seconds != null && data.walk_duration_seconds > 0)
        ? data.walk_duration_seconds
        : (dist / getCurrentSpeedPerSec());

      if (elapsedSec >= durationSec) {
        setPosition([targetLat, targetLng]);
        positionRef.current = [targetLat, targetLng];
        setTargetPosition(null);
        setIsWalking(false);
        walkTargetRef.current = null;
        walkStartRef.current = null;
        walkStartedAtRef.current = null;
        // 立即存入目的地，讓 DB 的 walk 欄位清空，避免下次刷新重複觸發
        setTimeout(() => saveProfileRef.current?.(undefined, [targetLat, targetLng]), 500);
      } else {
        const currentProgress = elapsedSec / durationSec;
        const currentLat = startLat + dLat * currentProgress;
        const currentLng = startLng + dLng * currentProgress;
        console.log('步行任務補償更新:', { currentLat, currentLng, progress: currentProgress });
        setPosition([currentLat, currentLng]);
        positionRef.current = [currentLat, currentLng];
        setTargetPosition([targetLat, targetLng]);
        walkTargetRef.current = [targetLat, targetLng];
        walkStartRef.current = [startLat, startLng];
        walkStartedAtRef.current = startedAt;
        walkDurationSecRef.current = durationSec;
        setIsWalking(true);
      }
    }

    // Restore travel state from DB if present
    if (data && data.travel_path && data.travel_started_at && data.travel_duration_seconds) {
      const path: [number, number][] = data.travel_path;
      if (path.length > 0) {
        const departedAt = new Date(data.travel_started_at);
        const durationSec: number = data.travel_duration_seconds;
        const elapsedSec = (Date.now() - departedAt.getTime()) / 1000;

        if (elapsedSec >= durationSec) {
          const finalPos = path[path.length - 1];
          setPosition(finalPos);
          positionRef.current = finalPos;
          setIsTraveling(false);
          setTravelPath([]);
          setTravelDepartedAt(null);
          setTravelDurationSec(0);
          travelPathRef.current = [];
          travelDepartedAtRef.current = null;
          travelDurationSecRef.current = 0;
        } else {
          setTravelPath(path);
          setTravelDepartedAt(departedAt);
          setTravelDurationSec(durationSec);
          travelPathRef.current = path;
          travelDepartedAtRef.current = departedAt;
          travelDurationSecRef.current = durationSec;
          setIsTraveling(true);
        }
      }
    }

    if (!silent) setLoading(false);
  };

  // Sync to database
  const saveProfile = useCallback(async (newState?: CharacterStats, forceLocation?: [number, number]) => {
    if (loading || isDoubleTabbedRef.current || isRpcPendingRef.current) return;
    const p = newState || playerRef.current;
    if (!p || !session?.user?.id) return;

    // Build travel persistence payload - Use REFS directly to avoid state sync lag
    const isCurrentlyOnTrain = travelPathRef.current.length > 0 && travelDepartedAtRef.current;

    const travelSaveData = (isCurrentlyOnTrain && travelDepartedAtRef.current)
      ? {
        travel_path: travelPathRef.current,
        travel_started_at: travelDepartedAtRef.current.toISOString(),
        travel_duration_seconds: travelDurationSecRef.current,
      }
      : {
        travel_path: null,
        travel_started_at: null,
        travel_duration_seconds: null,
      };

    const isCurrentlyWalking = walkTargetRef.current && walkStartedAtRef.current && walkStartRef.current;
    const walkSaveData = isCurrentlyWalking
      ? {
        walk_target_lat: walkTargetRef.current![0],
        walk_target_lng: walkTargetRef.current![1],
        walk_start_lat: walkStartRef.current![0],
        walk_start_lng: walkStartRef.current![1],
        walk_started_at: walkStartedAtRef.current!.toISOString(),
      }
      : {
        walk_target_lat: null,
        walk_target_lng: null,
        walk_start_lat: null,
        walk_start_lng: null,
        walk_started_at: null,
      };

    const { data: _updatedProfile, error: syncError } = await supabase.rpc('secure_sync_profile', {
      p_lat: forceLocation ? forceLocation[0] : positionRef.current[0],
      p_lng: forceLocation ? forceLocation[1] : positionRef.current[1],
      p_hp: p.hp,
      p_mp: p.mp,
      p_travel_data: {
        path: travelSaveData.travel_path,
        started_at: travelSaveData.travel_started_at,
        duration: travelSaveData.travel_duration_seconds
      },
      p_walk_data: {
        target_lat: walkSaveData.walk_target_lat,
        target_lng: walkSaveData.walk_target_lng,
        start_lat: walkSaveData.walk_start_lat,
        start_lng: walkSaveData.walk_start_lng,
        started_at: walkSaveData.walk_started_at,
        duration: walkDurationSecRef.current
      },
      p_active_god_id: p.activeGodId,
      p_partners: p.partners,
      p_buildings: p.buildings,
      p_gold: p.gold,
      p_base_materials: p.baseMaterials,
      p_equipment: p.equipment,
      p_items: p.items,
      p_skills: null, // Fully managed by server RPCs (secure_upgrade_skill, secure_resolve_combat) to prevent overwrite race conditions
      p_gods: null, // Fully managed by server RPCs
      p_equipped_weapon: p.equippedWeapon,
      p_equipped_armor: p.equippedArmor,
      p_equipped_helmet: p.equippedHelmet,
      p_equipped_boots: p.equippedBoots,
      p_equipped_accessory: p.equippedAccessory,
      p_ling_qi: p.lingQi,
      p_tech_fragments: p.techFragments,
      p_incense: p.incense,
      p_salt_crystals: p.saltCrystals,
      p_premium_gems: p.premiumGems,
      p_last_updated_at: p.updatedAt
    });

    if (syncError) {
      console.error('Save Profile Error:', (syncError as any).message);
    } else if (_updatedProfile) {
      console.log('Profile Saved Successfully');
      // Sync local state with authoritative server timestamp/data
      setPlayer(mapServerProfile(_updatedProfile));
    }
  }, [session, mySessionId, isTraveling, loading]);

  const pendingSaveRef = React.useRef<any>(null);

  useEffect(() => {
    if (!player || !session?.user?.id) return;

    // Throttled Auto-Save: 5000ms. 確保連續移動或狀態更新時，不會被打斷存檔。
    if (!pendingSaveRef.current) {
      pendingSaveRef.current = setTimeout(() => {
        saveProfile();
        pendingSaveRef.current = null;
      }, 5000);
    }
  }, [player, position, session, saveProfile]);

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    };
  }, []);

  // Keep the saveProfileRef in sync with the latest saveProfile function
  useEffect(() => {
    saveProfileRef.current = saveProfile;
  }, [saveProfile]);

  // Resource tick
  useEffect(() => {
    const t = window.setInterval(() => {
      if (isDoubleTabbedRef.current) return;
      setPlayer(p => {
        if (!p) return null;
        let dg = 0, dm = 0;
        p.buildings.forEach(b => {
          // Calculate bonus
          let goldBonus = 0;
          let matBonus = 0;
          const assigned = p.partners.filter(pt => b.assignedPartners?.includes(pt.id));
          assigned.forEach(pt => {
            let mult = pt.rarity === 5 ? 0.05 : pt.rarity === 4 ? 0.03 : 0.02;
            if (pt.role === 'tank' && (b.type === 'material_camp' || b.name.includes('營地') || b.name.includes('工坊'))) {
              matBonus += mult;
            } else if (pt.role === 'healer' && b.type === 'gold_mine') {
              goldBonus += mult;
            }
          });

          if (b.type === 'gold_mine') {
            dg += (b.baseProduction * (1 + goldBonus)) / 60;
          } else if (b.type === 'material_camp') {
            dm += (b.baseProduction * (1 + matBonus)) / 60;
          }
        });

        if (dg === 0 && dm === 0) {
          return p;
        }
        return { ...p, gold: p.gold + dg, baseMaterials: p.baseMaterials + dm };
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const [isCombatAction, setIsCombatAction] = useState(false);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [autoExplore, setAutoExplore] = useState(() => localStorage.getItem('autoExplore_v1') === 'true');

  useEffect(() => {
    localStorage.setItem('autoExplore_v1', String(autoExplore));
  }, [autoExplore]);

  // --- Session Stats Logic (Tracking Duration) ---
  useEffect(() => {
    if (!autoExplore || !sessionStartTime) return;
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [autoExplore, sessionStartTime]);

  // Auto-minimize combat when switching tabs
  useEffect(() => {
    if (isCombatAction && activeTab !== 'explore') {
      setIsCombatMinimized(true);
    } else if (isCombatAction && activeTab === 'explore') {
      setIsCombatMinimized(false);
    }
  }, [activeTab, isCombatAction]);

  const move = useCallback((d: 'n' | 's' | 'e' | 'w') => {
    const s = 0.00025;
    // Clear walking persistence when manual control takes over
    walkTargetRef.current = null;
    walkStartRef.current = null;
    walkStartedAtRef.current = null;
    walkDurationSecRef.current = 0;

    setPosition(p => {
      const next: [number, number] = d === 'n' ? [p[0] + s, p[1]] : d === 's' ? [p[0] - s, p[1]] : d === 'e' ? [p[0], p[1] + s] : [p[0], p[1] - s];
      // Immediate save when manually moving to clear any active targetPosition in DB
      saveProfileRef.current?.(undefined, next);
      return next;
    });
    setTargetPosition(null); // Cancel click-to-move if using D-Pad
  }, []);

  // Keyboard Support (WASD) - Continuous Smooth Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTraveling || activeTab !== 'explore' || inTown || activePoiCombat) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') startMove('n');
      else if (key === 's' || key === 'arrowdown') startMove('s');
      else if (key === 'a' || key === 'arrowleft') startMove('w');
      else if (key === 'd' || key === 'arrowright') startMove('e');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      let dir: 'n' | 's' | 'e' | 'w' | null = null;
      if (key === 'w' || key === 'arrowup') dir = 'n';
      else if (key === 's' || key === 'arrowdown') dir = 's';
      else if (key === 'a' || key === 'arrowleft') dir = 'w';
      else if (key === 'd' || key === 'arrowright') dir = 'e';

      if (dir && moveDirRef.current === dir) stopMove();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isTraveling, activeTab, inTown, activePoiCombat]);

  // Continuous Movement Loop (for Hold-to-Move)
  useEffect(() => {
    let frameId: number;
    const CONTINUOUS_SPEED = 0.00006; // Speed per frame during hold

    const animate = () => {
      if (moveDirRef.current && !isTraveling && activeTab === 'explore' && !inTown && !activePoiCombat) {
        const d = moveDirRef.current;
        setPosition(p => {
          const s = CONTINUOUS_SPEED;
          const nextPos: [number, number] = d === 'n' ? [p[0] + s, p[1]] : d === 's' ? [p[0] - s, p[1]] : d === 'e' ? [p[0], p[1] + s] : [p[0], p[1] - s];

          if (!isInTaiwan(nextPos[0], nextPos[1])) {
            stopMove(); // hit the wall
            return p;
          }
          return nextPos;
        });
        setIsWalking(true);
      } else if (!targetPosition) {
        setIsWalking(false);
      }
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isTraveling, activeTab, inTown, activePoiCombat, targetPosition]);

  const startMove = (d: 'n' | 's' | 'e' | 'w') => {
    moveDirRef.current = d;
    setTargetPosition(null);
    // Clear walking persistence when manual control takes over
    walkTargetRef.current = null;
    walkStartRef.current = null;
    walkStartedAtRef.current = null;
    walkDurationSecRef.current = 0;
    // Immediate save to clear walking/targeting persistence when manual control takes over
    saveProfileRef.current?.();
    if ('vibrate' in navigator) navigator.vibrate(10); // Subtle haptic feedback
  };

  const stopMove = () => {
    moveDirRef.current = null;
  };

  const activeGod = useMemo(() => {
    if (!player || !player.activeGodId) return null;
    return player.gods.find(g => g.id === player.activeGodId) || null;
  }, [player?.activeGodId, player?.gods]);

  // Memoize Icons to prevent shaking (re-creation of DIV icons kills performance)
  const playerIcon = useMemo(() => {
    const avatar = isTraveling ? '🚂' : isWalking ? '🏃‍♂️' : '🧙‍♂️';
    return createPlayerIcon(avatar, activeGod?.avatar);
  }, [isTraveling, isWalking, activeGod?.avatar]);

  const hasWeatherResistance = useCallback((type: WeatherType) => {
    if (!activeGod) return false;
    // Lv.10 unlocks all weather resistance
    if (activeGod.level >= 10) return true;
    return activeGod.resistanceType === type || activeGod.resistanceType === 'all';
  }, [activeGod]);

  // ⚡ Stormy weather: drain 1% max HP every 10 seconds on the map
  useEffect(() => {
    const effect = WEATHER_TYPES[weather];
    if (!effect || effect.envHpTickDmg <= 0) return;
    if (activeTab !== 'explore' || !!inTown || !!activePoiCombat || isTraveling || !player) return;

    const interval = setInterval(() => {
      if (hasWeatherResistance(weather)) return; // God protection
      setPlayer(prev => {
        if (!prev) return prev;
        const effectiveMaxHp = getEffectiveMaxHp(prev);
        const drain = Math.max(1, Math.floor(effectiveMaxHp * effect.envHpTickDmg));
        const newHp = Math.max(0, prev.hp - drain);
        return { ...prev, hp: newHp };
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [weather, activeTab, inTown, activePoiCombat, isTraveling, player, hasWeatherResistance]);


  // Auto-Interaction detection when moving near Towns or POIs
  useEffect(() => {
    if (isTraveling || inTown || activePoiCombat || activeTab !== 'explore' || !player) return;

    // 1. Gather candidates (POIs prioritized over towns as they are more specific)
    const nearbyPoi = pois.find(p => getDistance(position[0], position[1], p.lat, p.lng) <= 400);
    const nearbyTown = TOWN_DATABASE.find(t => getDistance(position[0], position[1], t.lat, t.lng) <= t.radius);

    // 2. Decide what to show
    let target: { type: 'poi', poi: MapPOI } | { type: 'town', town: Town } | null = null;

    if (nearbyPoi && lastDismissedIdRef.current !== nearbyPoi.id) {
      target = { type: 'poi', poi: nearbyPoi };
    } else if (nearbyTown && lastDismissedIdRef.current !== nearbyTown.id) {
      target = { type: 'town', town: nearbyTown };
    }

    // 3. Update local state
    if (target) {
      const isDifferent = !interactingLocation ||
        (target.type === 'poi' && (interactingLocation.type !== 'poi' || interactingLocation.poi.id !== target.poi.id)) ||
        (target.type === 'town' && (interactingLocation.type !== 'town' || interactingLocation.town.id !== target.town.id));
      if (isDifferent) setInteractingLocation(target);
    } else {
      if (interactingLocation) {
        const stillNear = interactingLocation.type === 'poi'
          ? getDistance(position[0], position[1], interactingLocation.poi.lat, interactingLocation.poi.lng) <= 450
          : getDistance(position[0], position[1], interactingLocation.town.lat, interactingLocation.town.lng) <= interactingLocation.town.radius + 100;
        if (!stillNear) { setInteractingLocation(null); lastDismissedIdRef.current = null; }
      } else {
        lastDismissedIdRef.current = null;
      }
    }
  }, [position, pois, isTraveling, inTown, activePoiCombat, activeTab, player, interactingLocation]);

  // Click-to-Move Walking Animation (Time-based for persistence)
  useEffect(() => {
    if (!targetPosition || isTraveling) {
      if (!isTraveling) {
        setIsWalking(false);
        walkTargetRef.current = null;
        walkStartRef.current = null;
        walkStartedAtRef.current = null;
        walkDurationSecRef.current = 0;
      } else {
        setIsWalking(false);
      }
      return;
    }

    let frameId: number;

    // Initialize refs if starting a new walk - Calculate trip duration ONCE
    if (!walkStartRef.current || !walkStartedAtRef.current || !walkTargetRef.current || walkTargetRef.current[0] !== targetPosition[0] || walkTargetRef.current[1] !== targetPosition[1]) {
      const startPos = [...positionRef.current] as [number, number];
      const targetPos = [...targetPosition] as [number, number];
      const dist = Math.hypot(targetPos[0] - startPos[0], targetPos[1] - startPos[1]);

      const currentWeather = weatherRef.current;
      const weatherSpeedMod = currentWeather && !hasWeatherResistance(currentWeather)
        ? WEATHER_TYPES[currentWeather].walkSpeedMod
        : (currentWeather === 'sunny' ? WEATHER_TYPES.sunny.walkSpeedMod : 1.0);
      const speedUsed = 0.0048 * weatherSpeedMod;

      walkStartRef.current = startPos;
      walkTargetRef.current = targetPos;
      walkStartedAtRef.current = new Date();
      walkDurationSecRef.current = dist / speedUsed;

      saveProfileRef.current?.(); // Trigger save to register walk start with duration
    }

    const animate = () => {
      const startLat = walkStartRef.current![0];
      const startLng = walkStartRef.current![1];
      const targetLat = walkTargetRef.current![0];
      const targetLng = walkTargetRef.current![1];
      const startedAt = walkStartedAtRef.current!;
      const durationSec = walkDurationSecRef.current;

      const elapsedSec = (Date.now() - startedAt.getTime()) / 1000;
      const dLat = targetLat - startLat;
      const dLng = targetLng - startLng;

      if (durationSec <= 0 || elapsedSec >= durationSec) {
        // Arrived — update positionRef FIRST before clearing walk refs
        positionRef.current = [targetLat, targetLng];
        setPosition([targetLat, targetLng]);
        setTargetPosition(null);
        setIsWalking(false);
        walkTargetRef.current = null;
        walkStartRef.current = null;
        walkStartedAtRef.current = null;
        walkDurationSecRef.current = 0;
        // Now save with forceLocation to guarantee the correct destination is written
        saveProfileRef.current?.(undefined, [targetLat, targetLng]);
        return;
      }

      setIsWalking(true);
      const currentProgress = elapsedSec / durationSec;
      const currentLat = startLat + dLat * currentProgress;
      const currentLng = startLng + dLng * currentProgress;

      if (!isInTaiwan(currentLat, currentLng)) {
        setTargetPosition(null);
        setIsWalking(false);
        walkTargetRef.current = null;
        walkStartRef.current = null;
        walkStartedAtRef.current = null;
        walkDurationSecRef.current = 0;
        saveProfileRef.current?.(undefined, [currentLat, currentLng]);
        return;
      }

      setPosition([currentLat, currentLng]);

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [targetPosition, isTraveling, weather, player?.activeGodId, hasWeatherResistance]);

  const handleSaveNickname = async () => {
    if (!player || !session?.user?.id || !tempNickname.trim()) {
      setIsEditingNickname(false);
      return;
    }
    const newName = tempNickname.trim();
    const nextState = { ...player, nickname: newName };
    setPlayer(nextState);
    setIsEditingNickname(false);

    // Save to DB immediately
    await supabase.from('profiles').update({ nickname: newName }).eq('id', session.user.id);
  };

  const startHunt = useCallback(async (isElite = false) => {
    if (isTravelingRef.current) {
      console.log('Cannot hunt: Traveling');
      return;
    }

    // 1. Encounter Check via Backend (Only for non-Elite/POI checks or when called from Explore)
    // Use the dynamic encounter rate from the backend (secure_check_encounter already handles the rate)
    const { data: enc, error: encError } = await supabase.rpc('secure_check_encounter', {
      p_weather: weatherRef.current,
      p_force: !autoExplore // Manual button always forces encounter
    });

    if (encError) {
      console.error('Encounter check error:', encError);
    }

    if (!isElite && (!enc || enc.result === 'none')) {
      if (!autoExplore) {
        console.warn('Manual Hunt failed to force encounter - check server RPC');
      }
      return;
    }

    const isWeatherSpecial = enc?.result === 'weather_special';
    const p = playerRef.current;
    if (!p) return;

    const lv = p.level;

    // Helper: get prefix based on monster level (not player level)
    const getMonsterPrefix = (monsterLv: number): string => {
      if (monsterLv <= 10) return '呆滯的';
      if (monsterLv <= 20) return '溫馴的';
      if (monsterLv <= 30) return '膽小的';
      if (monsterLv <= 40) return '頑皮的';
      if (monsterLv <= 50) return '躁動的';
      if (monsterLv <= 60) return '憤怒的';
      if (monsterLv <= 70) return '殘酷的';
      if (monsterLv <= 80) return '嗜血的';
      if (monsterLv <= 90) return '狂暴的';
      if (monsterLv <= 100) return '災厄級的';
      const tier = Math.floor((monsterLv - 101) / 10) + 1;
      return `災厄${tier}階`;
    };

    // 1. Filter monsters based on player level (Progressive Scaling)
    let availableMonsters = MONSTER_DATABASE.filter(m => lv >= (m.minLv || 0) && lv <= (m.maxLv || 999));

    // Fallback: If player outlevels everything, pick from the highest tier
    if (availableMonsters.length === 0) {
      const maxAvailableLv = Math.max(...MONSTER_DATABASE.map(m => m.minLv || 0));
      availableMonsters = MONSTER_DATABASE.filter(m => (m.minLv || 0) >= maxAvailableLv);
    }

    // Final defensive fallback: Use full database
    if (availableMonsters.length === 0) availableMonsters = MONSTER_DATABASE;

    const template = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];

    const isBoss = isElite && template.name.includes('黑龍');
    // Weather Special enemies are roughly 2x stronger than normal
    const statMultiplier = (isElite ? 2.5 : 1) * (isWeatherSpecial ? 2.0 : 1.0);

    let hp, eAtk, eDef;

    if (isElite || isBoss || isWeatherSpecial) {
      const pHP = getEffectiveMaxHp(p);
      const pATK = getEffectiveAtk(p);
      const pDEF = getEffectiveDef(p);

      const diffMultiplier = isBoss ? 1.5 : (isWeatherSpecial ? 1.2 : 1.0);

      const baseHp = Math.max(template.baseHp * statMultiplier, pATK * (5 + Math.random() * 3) * diffMultiplier);
      const targetDmgPerHit = pHP * (0.15 + Math.random() * 0.05) * diffMultiplier;
      const baseAtk = Math.max(template.baseAtk * statMultiplier, pDEF + targetDmgPerHit);
      const baseDef = Math.max(template.baseDef * statMultiplier, pATK * 0.3 * diffMultiplier);

      hp = Math.floor(baseHp);
      eAtk = Math.floor(baseAtk);
      eDef = Math.floor(baseDef);
    } else {
      hp = Math.floor((template.baseHp + lv * 8) * statMultiplier);
      eAtk = Math.floor((template.baseAtk + lv * 2) * statMultiplier);
      eDef = Math.floor((template.baseDef + Math.floor(lv * 0.8)) * statMultiplier);
    }

    // Calculate the actual monster level for prefix naming
    const monsterLv = lv + Math.floor(Math.random() * 3) - 1 + (isBoss ? 5 : isElite ? 2 : isWeatherSpecial ? 3 : 0);
    const prefix = getMonsterPrefix(monsterLv);
    const specialTag = isBoss ? '【首領】' : isElite ? '【菁英】' : isWeatherSpecial ? '【掩人耳目】' : '';

    const enemy = {
      id: Math.random().toString(),
      // Display name includes prefix (e.g. "【菁英】狂暴的 史萊姆")
      name: `${specialTag}${prefix} ${template.name}`,
      // baseName is the original name for quest matching (e.g. "史萊姆")
      baseName: template.name,
      avatar: template.avatar,
      element: template.element,
      level: monsterLv,
      hp, maxHp: hp,
      attack: eAtk,
      defense: eDef,
      expReward: Math.floor(getRewardsByLevel(monsterLv).exp * (isElite ? 2.5 : 1) * (isWeatherSpecial ? 3 : 1)),
      goldReward: Math.floor(getRewardsByLevel(monsterLv).gold * (isElite ? 2.5 : 1) * (isWeatherSpecial ? 3 : 1)),
      lootTable: [],
      // Metadata for backend resolution
      isElite,
      isBoss,
      isWeatherSpecial,
      baseLv: lv
    };

    setCurrentEnemy(enemy as any);
    setIsCombatAction(true);
  }, [player?.level]);

  // Auto Explore Logic
  useEffect(() => {
    if (!autoExplore || isCombatAction || isTraveling || inTown) return;


    // Movement & Encounter cycle
    const encounterMover = setInterval(() => {
      if (isDoubleTabbedRef.current) return;

      // Pick random direction
      const dirs: ('n' | 's' | 'e' | 'w')[] = ['n', 's', 'e', 'w'];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      move(d);

      startHunt();
    }, 2000); // Move every 2 seconds

    return () => clearInterval(encounterMover);
  }, [autoExplore, isCombatAction, activeTab, move, startHunt]);

  const handleCombatWin = useCallback(async (_expReward: number, _goldReward: number, _learnedSkill?: Skill, _lootList?: GameItem[], _droppedEq?: Equipment, finalHp?: number, finalMp?: number) => {
    if (!player || !currentEnemy) return;

    const randomSkill = SKILL_DATABASE[Math.floor(Math.random() * SKILL_DATABASE.length)];

    isRpcPendingRef.current = true;
    const { data: result, error } = await supabase.rpc('secure_resolve_combat', {
      p_monster_name: currentEnemy.name,
      p_player_hp: finalHp ?? player.hp,
      p_player_mp: finalMp ?? player.mp,
      p_skill_reward_id: randomSkill.id,
      p_skill_reward_name: randomSkill.name,
      p_lat: positionRef.current[0],
      p_lng: positionRef.current[1],
      p_monster_level: currentEnemy.level
    });

    if (error) {
      console.error('❌ [Combat RPC Failed]:', error);
      alert(`戰鬥結算失敗: ${error.message || '未知錯誤'}`);
      setIsCombatAction(false);
      setCurrentEnemy(null);
      isRpcPendingRef.current = false;
      return;
    }

    if (!result) {
      console.error('❌ [Combat result empty]');
      setIsCombatAction(false);
      setCurrentEnemy(null);
      isRpcPendingRef.current = false;
      return;
    }

    // After success logic...
    // (Wait, I need to make sure I reset it at the end of the function too)

    if (result.updated_profile) {
      // 🚀 AUTHORITATIVE STATE SYNC
      const newP = mapServerProfile(result.updated_profile);
      playerRef.current = newP; // 即時同步引用，防止下一微秒的自動存檔抓取到舊狀態
      setPlayer(newP);
    }

    if (result.leveled_up) {
      setCombatLogs(prev => [...prev, {
        id: `lv_${Date.now()}`,
        type: 'win',
        enemyName: '系統',
        message: `🎊 恭喜！等級提升至 Lv.${result.new_level}！`
      } as CombatLog].slice(-6));
    }

    // Process result for UI display
    // NOTE: Supabase RPC can return JSONB as a string - force parse it
    let rawLoots = result.loots;
    const sLoots: any[] = Array.isArray(rawLoots)
      ? rawLoots
      : (typeof rawLoots === 'string' ? JSON.parse(rawLoots) : []);
    const sEquip = result.equipment;

    const rewardItems = sLoots.filter((l: any) => l.id !== 'currency_incense' && l.id !== 'p_exp' && l.id !== 'partner_exp');
    if (sEquip) rewardItems.push({ name: sEquip.name, quantity: 1, icon: sEquip.icon || '🛡️' });

    // Rewards are now only displayed in the bottom-right combat logs, as requested.

    // AUTHORITATIVE LOGGING
    const finalExp = result?.exp ?? _expReward;
    const finalGold = result?.gold ?? _goldReward;

    // Explicitly grab partner exp from loots for logging & stats
    const pExpLoot = sLoots.find((l: any) => l.id === 'p_exp' || l.id === 'partner_exp' || l.name?.includes('夥伴經驗'));
    const partnerExpAmount = pExpLoot ? (Number(pExpLoot.quantity) || 0) : 0;

    // --- Update Session Stats ---
    setSessionStats(prev => {
      const newItems = { ...prev.items };
      let incenseGained = 0;
      let partnerExpGained = 0;
      const isEliteOrBoss = currentEnemy.name.includes('菁英') || currentEnemy.name.includes('首領');

      sLoots.forEach((loot: any) => {
        if (loot.id === 'currency_incense') {
          incenseGained += (loot.quantity || 1);
        } else if (loot.id === 'partner_exp' || loot.id === 'p_exp') {
          partnerExpGained += (loot.quantity || 1);
        } else {
          const qty = loot.quantity || 1;
          const key = loot.name;
          if (!newItems[key]) {
            newItems[key] = { id: loot.id, name: loot.name, icon: loot.icon || '📦', quantity: 0 };
          }
          newItems[key].quantity += qty;
        }
      });

      if (sEquip) {
        const key = sEquip.name;
        if (!newItems[key]) {
          newItems[key] = { id: `eq_${key}`, name: sEquip.name, icon: sEquip.icon || '🛡️', quantity: 0 };
        }
        newItems[key].quantity += 1;
      }

      return {
        exp: prev.exp + finalExp,
        gold: prev.gold + finalGold,
        kills: prev.kills + 1,
        eliteKills: prev.eliteKills + (isEliteOrBoss ? 1 : 0),
        partnerExp: prev.partnerExp + partnerExpGained,
        incense: prev.incense + incenseGained,
        items: newItems
      };
    });

    const newLog: CombatLog = {
      id: `battle_${Date.now()}`,
      type: 'win',
      enemyName: currentEnemy.name,
      exp: finalExp,
      gold: finalGold,
      partnerExp: partnerExpAmount,
      items: rewardItems.map((i: any) => ({ name: i.name, quantity: i.quantity || 1, icon: i.icon || '📦' }))
    };
    setCombatLogs(prev => [newLog, ...prev].slice(0, 10)); // Keep more logs for debugging

    console.log('--- ⚔️ COMBAT RESOLVED ---', {
      monster: currentEnemy.name,
      receivedExp: finalExp,
      receivedGold: finalGold,
      leveledUp: result?.leveled_up,
      newLevel: result?.new_level,
      questProgress: result?.updated_profile?.quests
    });

    setIsCombatAction(false);
    setCurrentEnemy(null);

    // Quest: Kill and collection progress is now handled within server-side secure_resolve_combat
    // to prevent front-end spoofing. No further manual rpc calls needed here.
    checkQuestStatus();

    // Collection progress is also integrated into secure_resolve_combat's loot logic.

    if (activePoiRef.current) {
      // For POI (Elite/Special) victories, we resolve the POI state on DB
      await supabase.rpc('resolve_poi_combat', { p_poi_id: activePoiRef.current, p_win: true });
      setPois(prev => prev.filter(p => p.id !== activePoiRef.current));
      setActivePoiCombat(null);
      isRpcPendingRef.current = false;
    }

    isRpcPendingRef.current = false;
  }, [player, currentEnemy, fetchPois, session, saveProfile, mapServerProfile]);


  // ─── Weather Effects & Encounter Rate Logic ───


  const handleCombatLose = useCallback(async (finalHp?: number, finalMp?: number) => {
    if (!player) return;
    const nextHp = finalHp ?? Math.floor(player.maxHp * 0.15);
    const nextMp = finalMp ?? player.mp;
    const nextState = { ...player, hp: nextHp, mp: nextMp };

    const newLog: CombatLog = {
      id: Date.now().toString() + Math.random().toString(),
      type: 'lose',
      enemyName: currentEnemy?.name || '未知魔物',
      message: '扣除部分生命值'
    };
    setCombatLogs(prev => [...prev, newLog].slice(-6));

    setPlayer(nextState);
    saveProfile(nextState);
    setIsCombatAction(false);
    setCurrentEnemy(null);

    if (activePoiRef.current) {
      const poiId = activePoiRef.current;
      await supabase.rpc('resolve_poi_combat', { p_poi_id: poiId, p_win: false });
      eliteCooldownsRef.current[poiId] = Date.now() + 10000;
      setActivePoiCombat(null);
      fetchPois();
    }
  }, [player, saveProfile, fetchPois, currentEnemy]);

  const equipItem = useCallback(async (eq: Equipment) => {
    if (!player || !session?.user?.id) return;
    const { data: result, error } = await supabase.rpc('secure_equip_item', {
      p_equip_id: eq.id,
      p_slot: eq.slot,
      p_equipment_inventory: player.equipment
    });

    if (error || !result?.success) {
      console.error('[equipItem] RPC failed:', error?.message || result?.message);
      return;
    }

    const newP = mapServerProfile(result.updated_profile);
    playerRef.current = newP;
    setPlayer(newP);
  }, [player, session, mapServerProfile]);

  const unequipItem = useCallback(async (slot: string) => {
    if (!player || !session?.user?.id) return;
    const { data: result, error } = await supabase.rpc('secure_equip_item', {
      p_equip_id: null,
      p_slot: slot,
      p_equipment_inventory: player.equipment
    });

    if (error || !result?.success) {
      console.error('[unequipItem] RPC failed:', error?.message || result?.message);
      return;
    }

    const newP = mapServerProfile(result.updated_profile);
    playerRef.current = newP;
    setPlayer(newP);
  }, [player, session, mapServerProfile]);

  const useItem = useCallback(async (item: GameItem, silent = false) => {
    if (!player || !session?.user?.id || (item.type !== 'potion' && item.type !== 'consumable')) return;

    // Call server to persist usage and get authoritative state
    const { data: result, error } = await supabase.rpc('secure_batch_use_item', {
      p_item_id: item.id,
      p_count: 1
    });

    if (error) {
      console.error("Use item error:", error);
      return;
    }

    if (result && result.success && result.updated_profile) {
      // Authoritative Local Sync
      const newP = mapServerProfile(result.updated_profile);
      playerRef.current = newP;
      setPlayer(newP);

      if (!silent) {
        const recoverItems = [];
        if (result.hp_recovered > 0) recoverItems.push({ name: '恢復生命', quantity: result.hp_recovered, icon: '💖' });
        if (result.mp_recovered > 0) recoverItems.push({ name: '恢復魔力', quantity: result.mp_recovered, icon: '💧' });
        if (result.str_gained > 0) recoverItems.push({ name: '攻擊永久提升', quantity: result.str_gained, icon: '⚔️' });
        if (result.def_gained > 0) recoverItems.push({ name: '防禦永久提升', quantity: result.def_gained, icon: '🛡️' });
        if (result.max_hp_gained > 0) recoverItems.push({ name: '生命上限永久提升', quantity: result.max_hp_gained, icon: '❤️' });

        setLootMessage({
          title: '使用道具紀錄',
          items: [
            { name: item.name, quantity: 1, icon: ITEM_DATABASE.find(itemDef => itemDef.id === item.id)?.icon ?? item.icon },
            ...recoverItems
          ]
        });
      }
    }
  }, [player, session, mapServerProfile]);

  const handleBatchUseItem = useCallback(async () => {
    if (!player || !session?.user?.id || !batchUseItem) return;

    const { data: result, error } = await supabase.rpc('secure_batch_use_item', {
      p_item_id: batchUseItem.id,
      p_count: batchAmount
    });

    if (error) {
      alert(`使用失敗: ${error.message}`);
      return;
    }

    if (result && result.success && result.updated_profile) {
      // Authoritative State Sync
      const newP = mapServerProfile(result.updated_profile);
      playerRef.current = newP;
      setPlayer(newP);

      setLootMessage({
        title: '✨ 批量使用成功！',
        items: [
          { name: batchUseItem.name, quantity: batchAmount, icon: batchUseItem.icon },
          result.str_gained > 0 ? { name: '力量提升', quantity: result.str_gained, icon: '💪' } : null,
          result.def_gained > 0 ? { name: '防禦提升', quantity: result.def_gained, icon: '🛡️' } : null,
          result.hp_recovered > 0 ? { name: '生命恢復', quantity: result.hp_recovered, icon: '💖' } : null,
          result.mp_recovered > 0 ? { name: '魔力恢復', quantity: result.mp_recovered, icon: '💧' } : null,
          result.max_hp_gained > 0 ? { name: '生命上限提升', quantity: result.max_hp_gained, icon: '❤️' } : null,
        ].filter(Boolean) as any
      });
      setBatchUseItem(null);
      setBatchAmount(1);
    }
  }, [player, session, batchUseItem, batchAmount, mapServerProfile]);


  const handleCraftAlchemy = useCallback(async (recipe: AlchemyRecipe) => {
    if (!player) return;

    const { data: result, error } = await supabase.rpc('secure_craft_alchemy', {
      p_recipe_id: recipe.id
    });

    if (error) {
      alert('煉金失敗: ' + error.message);
      return;
    }

    if (result && result.updated_profile) {
      const newP = mapServerProfile(result.updated_profile);
      playerRef.current = newP;
      setPlayer(newP);
    }

    // Quest: craft progress tracking
    if (session?.user?.id) {
      supabase.rpc('increment_craft_quests', {
        p_user_id: session.user.id,
        p_increment: 1
      }).then();
    }
  }, [player, session]);

  const handleCraftEquipment = useCallback(async (recipe: BlacksmithRecipe) => {
    if (!player) return;
    setForgingRecipeId(recipe.id);

    isRpcPendingRef.current = true;
    const { data, error } = await supabase.rpc('secure_craft_equipment', {
      p_recipe_id: recipe.id
    });

    if (error) {
      alert('鍛造失敗: ' + error.message);
      setForgingRecipeId(null);
      isRpcPendingRef.current = false;
      return;
    }

    if (data && data.updated_profile) {
      const newP = mapServerProfile(data.updated_profile);
      playerRef.current = newP;
      setPlayer(newP);
    }

    setForgingRecipeId(null);
    isRpcPendingRef.current = false;
    const newEquip = data.equipment;

    // Show completion popup
    if (newEquip) {
      setLootMessage({
        title: '製作完成',
        items: [{ name: newEquip.name, quantity: 1, icon: newEquip.icon || '🛡️' }],
        gold: 0,
        exp: 0
      } as any);
    }

    // Quest: craft progress tracking
    if (session?.user?.id) {
      supabase.rpc('increment_craft_quests', {
        p_user_id: session.user.id,
        p_increment: 1
      }).then();
    }
  }, [player, session]);

  const handleSellItem = useCallback(async (item: GameItem) => {
    if (!player) return;

    isRpcPendingRef.current = true;
    const { data: result, error } = await supabase.rpc('secure_sell_item', {
      p_item_id: item.id,
      p_quantity: 1
    });

    if (error) {
      alert(`交易失敗: ${error.message}`);
    } else if (result?.updated_profile) {
      const newP = mapServerProfile(result.updated_profile);
      playerRef.current = newP;
      setPlayer(newP);
    }
    isRpcPendingRef.current = false;
  }, [player, mapServerProfile]);

  const handleSellEquipment = useCallback(async (equipment: Equipment) => {
    if (!player || !session?.user?.id) return;

    isRpcPendingRef.current = true;
    const { data: result, error } = await supabase.rpc('secure_sell_equipment', {
      p_equipment_id: equipment.id
    });

    if (error) {
      alert(`交易失敗: ${error.message}`);
      isRpcPendingRef.current = false;
      return;
    }

    if (result && result.success && result.updated_profile) {
      const newP = mapServerProfile(result.updated_profile);
      playerRef.current = newP;
      setPlayer(newP);
      console.log(`Successfully sold ${equipment.name} for ${result.gold_gained} gold`);
    }
    isRpcPendingRef.current = false;
  }, [player, session?.user?.id]);

  const handleUpgradeSkill = useCallback(async (skillId: string) => {
    if (!player || !session?.user?.id) return;

    const skillIdx = player.skills.findIndex(s => s.id === skillId);
    if (skillIdx < 0) return;

    isRpcPendingRef.current = true;
    const { data: result, error } = await supabase.rpc('secure_upgrade_skill', {
      p_skill_id: skillId
    });

    if (error) {
      alert(`升級請求失敗: ${error.message}`);
      isRpcPendingRef.current = false;
      return;
    }

    if (result && result.updated_profile) {
      const newP = mapServerProfile(result.updated_profile);
      playerRef.current = newP;
      setPlayer(newP);
      if (result.success) {
        setLootMessage({
          title: '✨ 技能升級成功！',
          items: [{
            name: SKILL_DATABASE.find(s => s.id === skillId)?.name || '技能',
            quantity: result.new_level,
            icon: '⬆️'
          }]
        });
      } else {
        alert(result?.message || '升級失敗，運氣不佳...');
      }
    }
    isRpcPendingRef.current = false;
  }, [player, session?.user?.id]);

  const handleTravel = useCallback(async (destinationTown: Town) => {
    if (!player || !inTown) return;

    // Calculate distance-based cost (simplified: 10 gold per km)
    const dist = getDistance(position[0], position[1], destinationTown.lat, destinationTown.lng);
    const cost = Math.max(50, Math.floor(dist / 100)); // 1 gold per 100m, min 50

    if (player.gold < cost) {
      alert(`金幣不足！移動至 ${destinationTown.name} 需要 ${cost} 金幣`);
      return;
    }

    const path = getRailwayPath(inTown.id, destinationTown.id);
    if (path.length < 2) {
      alert('目前無法到達該城市');
      return;
    }

    // Time-based travel: compute total seconds based on path length
    // TRAVEL_SPEED_FACTOR = 0.0008 units/frame at 60fps
    // progress goes from 0 to (path.length-1), so total frames = (path.length-1)/0.0008
    const TRAVEL_SPEED_FACTOR = 0.0016; // 2x faster (original 0.0008)
    const totalDurationSec = (path.length - 1) / TRAVEL_SPEED_FACTOR / 60;
    const departedAt = new Date();

    const nextState = { ...player, gold: player.gold - cost };
    setPlayer(nextState);
    setInTown(null);
    setTravelPath(path);
    setTravelDepartedAt(departedAt);
    setTravelDurationSec(totalDurationSec);
    setIsTraveling(true);

    // Immediately persist to DB so other devices can resume
    await supabase.from('profiles').update({
      gold: nextState.gold,
      travel_path: path,
      travel_started_at: departedAt.toISOString(),
      travel_duration_seconds: totalDurationSec,
      updated_at: new Date().toISOString()
    }).eq('id', session!.user.id);

    // Quest: travel progress tracking
    if (session?.user?.id) {
      supabase.rpc('increment_travel_quests', {
        p_user_id: session.user.id,
        p_increment: 1
      }).then();
    }
  }, [player, inTown, position, session]);


  const poiIconsMapping = useMemo(() => ({
    chest: createPoiIcon('chest'),
    merchant: createPoiIcon('merchant'),
    elite: createPoiIcon('elite'),
    altar: createPoiIcon('altar')
  }), []);




  const effectiveAtk = player ? getEffectiveAtk(player) : 0;
  const effectiveDef = player ? getEffectiveDef(player) : 0;
  const effectiveMaxHp = player ? getEffectiveMaxHp(player) : 0;
  const effectiveHeal = player ? totalPartnerHeal(player) : 0;

  // Interaction Handler for POIs (Refactored to handle interactions gracefully)
  const executePoiInteraction = useCallback(async (poi: MapPOI) => {
    if (!session?.user?.id || isTraveling) return;

    if (poi.type === 'elite') {
      const cd = eliteCooldownsRef.current[poi.id];
      if (cd && Date.now() < cd) {
        alert(`剛從戰鬥中撤退，請等待 ${Math.ceil((cd - Date.now()) / 1000)} 秒後再重新挑戰！`);
        return;
      }
      if (poi.lockedBy && poi.lockedBy !== session.user.id) {
        alert('這名菁英怪正在與其他玩家戰鬥中！');
        return;
      }
    }

    // DB Check
    const { data: success, error } = await supabase.rpc('interact_poi', { p_poi_id: poi.id });
    if (error || !success) {
      alert('這項事件已經消失，或是已經被其他人搶先觸發了！');
      fetchPois(); // Refresh immediately
      setInteractingLocation(null);
      return;
    }

    // Success! Update local state
    if (poi.type === 'chest') {
      setPois(prev => prev.filter(p => p.id !== poi.id)); // Remove the POI locally
    } else if (poi.type === 'elite') {
      setPois(prev => prev.map(p => p.id === poi.id ? { ...p, lockedBy: session?.user?.id, lockedAt: Date.now() } : p));
      setActivePoiCombat(poi.id);
    }

    if (!player) return;

    if (poi.type === 'merchant') {
      // 5% Chance for Regional Gift
      if (Math.random() < 0.05) {
        let region = getRegionByCoordinates(positionRef.current[0], positionRef.current[1]);
        if (region === 'unknown') {
          region = getRegionByCityName(areaName);
        }
        const mats = getRegionalMaterials(region);
        if (mats.length > 0) {
          const targetId = mats[Math.floor(Math.random() * mats.length)];
          const itemDef = ITEM_DATABASE.find(i => i.id === targetId);
          if (itemDef) {
            const currentList = [...player.items];
            const existing = currentList.find(i => i.id === targetId);
            if (existing) existing.quantity = (existing.quantity || 1) + 2;
            else currentList.push({ ...itemDef, quantity: 2 } as GameItem);

            setLootMessage({
              title: '商人好感贈禮！',
              items: [{ name: itemDef.name, quantity: 2, icon: itemDef.icon }]
            });
            const nextState = { ...player, items: currentList };
            setPlayer(nextState);
            saveProfile(nextState);
          }
        }
      }
      activeMerchantPoiRef.current = poi.id;
      setIsMerchantOpen(true);
      setInteractingLocation(null);
    } else if (poi.type === 'chest') {
      const goldBounty = 100 + player.level * 20;
      let newItems = [...player.items];
      const itemsGot: { name: string; quantity: number; icon: string }[] = [];

      itemsGot.push({ name: '金幣', quantity: goldBounty, icon: '💰' });

      const rand = Math.random();
      // 10% chance for 3 herbs
      if (rand < 0.1) {
        const herbDef = ITEM_DATABASE.find(i => i.id === 'item_herb');
        if (herbDef) {
          const existing = newItems.find(i => i.id === 'item_herb');
          if (existing) existing.quantity = (existing.quantity ?? 1) + 3;
          else newItems.push({ ...herbDef, quantity: 3 } as GameItem);
          itemsGot.push({ name: herbDef.name, quantity: 3, icon: herbDef.icon });
        }
      }

      if (Math.random() < 0.01) {
        const potDef = ITEM_DATABASE.find(i => i.id === 'item_revive_pot');
        if (potDef) {
          const existingPot = newItems.find(i => i.id === 'item_revive_pot');
          if (existingPot) existingPot.quantity = (existingPot.quantity ?? 1) + 1;
          else newItems.push({ ...potDef, quantity: 1 } as GameItem);
          itemsGot.push({ name: potDef.name, quantity: 1, icon: potDef.icon });
        }
      }

      // 1% 機率獲得靈石 (Premium Gems)
      let gemBounty = 0;
      if (Math.random() < 0.01) {
        gemBounty = Math.floor(Math.random() * 2) + 1; // 1-2 顆
        itemsGot.push({ name: '靈石', quantity: gemBounty, icon: '💎' });
      }

      setLootMessage({
        title: '發現了物資箱！',
        items: itemsGot
      });

      const nextState = {
        ...player,
        gold: player.gold + goldBounty,
        premiumGems: (player.premiumGems ?? 0) + gemBounty,
        items: newItems
      };
      setPlayer(nextState);
      saveProfile(nextState);
      setInteractingLocation(null);

      // Quest: collect progress tracking
      if (session?.user?.id) {
        supabase.rpc('increment_collect_quests', {
          p_user_id: session.user.id,
          p_increment: 1
        }).then();
      }
    } else if (poi.type === 'altar') {
      // Heal both HP and MP to full, and gain Incense
      const currentMaxHp = getEffectiveMaxHp(player);
      const incenseGain = Math.floor(Math.random() * 6) + 5; // 5-10 incense
      const nextState = {
        ...player,
        hp: currentMaxHp,
        mp: player.maxMp,
        incense: (player.incense ?? 0) + incenseGain
      };
      setLootMessage({
        title: '虔誠供奉',
        items: [{ name: '香火', quantity: incenseGain, icon: '🕯️' }]
      });
      setPlayer(nextState);
      saveProfile(nextState);
      setInteractingLocation(null);

      // Quest: Explore progress
      if (session?.user?.id) {
        supabase.rpc('increment_explore_quests', { p_user_id: session.user.id }).then();
      }
    }

    if (poi.type === 'elite') {
      startHunt(true);
      setInteractingLocation(null);
    }
  }, [startHunt, session, fetchPois, player, saveProfile, areaName]);





  // Handle clicking on POIs or Towns (require 2 clicks to move)
  const handleMarkClick = useCallback((id: string, lat: number, lng: number) => {
    if (isTraveling || inTown || activePoiCombat) return;

    let label = '未知地點';
    const town = TOWN_DATABASE.find(t => t.id === id);
    if (town) {
      label = town.name;
      if (getDistance(positionRef.current[0], positionRef.current[1], town.lat, town.lng) <= town.radius) {
        setInteractingLocation({ type: 'town', town });
      } else {
        setPendingTarget({ lat, lng, label });
      }
      return;
    }

    const poi = pois.find(p => p.id === id);
    if (poi) {
      label = POI_NAMES[poi.type] || '神秘地點';
      if (getDistance(positionRef.current[0], positionRef.current[1], poi.lat, poi.lng) <= 250) {
        lastDismissedIdRef.current = null; // Reset dismissal on manual click
        setInteractingLocation({ type: 'poi', poi });
      } else {
        setPendingTarget({ lat, lng, label });
      }
      return;
    }

    if (!isInTaiwan(lat, lng)) {
      alert('系統偵測前方為汪洋大海或境外區域，勇者無法前往該地！');
      setPendingTarget(null);
      return;
    }

    setPendingTarget({ lat, lng, label });
  }, [isTraveling, inTown, activePoiCombat, pois]);

  const pendingConfirmIcon = useMemo(() => {
    if (!pendingTarget) return null;
    return createConfirmIcon(pendingTarget.label);
  }, [pendingTarget?.label]);

  // Memoize Map Layers
  const townLayers = useMemo(() => TOWN_DATABASE.flatMap(t => [
    <Circle
      key={`circle-${t.id}`}
      center={[t.lat, t.lng]}
      radius={t.radius}
      pathOptions={{ color: t.color, fillColor: t.color, fillOpacity: 0.1, weight: 2, bubblingMouseEvents: false }}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e as any);
          handleMarkClick(t.id, t.lat, t.lng);
        }
      }}
    />,
    <Marker
      key={`label-${t.id}`}
      position={[t.lat, t.lng]}
      icon={createCityLabelIcon(t.name)}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e as any);
          handleMarkClick(t.id, t.lat, t.lng);
        }
      }}
    />
  ]), [handleMarkClick]);

  const poiLayers = useMemo(() => {
    // 基礎可視半徑 3000 公尺 (約 0.03 度)
    const baseRadius = 3000;
    const radiusMod = (weather && !hasWeatherResistance(weather)) ? WEATHER_TYPES[weather].poiRadiusMod : 1.0;
    const visibilityRadius = baseRadius * radiusMod;

    return pois
      .filter(p => getDistance(position[0], position[1], p.lat, p.lng) <= visibilityRadius)
      .map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={poiIconsMapping[p.type]}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e as any);
              handleMarkClick(p.id, p.lat, p.lng);
            }
          }}
        />
      ));
  }, [pois, poiIconsMapping, handleMarkClick, weather, hasWeatherResistance, position]);

  // Static facility POI layers (Shipyard/Dock) - always visible
  const facilityLayers = useMemo(() => {
    const layers: React.ReactNode[] = [];
    TOWN_DATABASE.forEach(town => {
      (['shipyard', 'dock'] as const).forEach(fac => {
        if (!town.facilities.includes(fac)) return;
        // Offset slightly so icons don't overlap city center
        const offset = fac === 'shipyard' ? [-0.003, 0.007] : [0.003, 0.007];
        const lat = town.lat + offset[0];
        const lng = town.lng + offset[1];
        const label = fac === 'shipyard' ? '造船廠' : '客運碼頭';
        layers.push(
          <Marker
            key={`fac-${town.id}-${fac}`}
            position={[lat, lng]}
            icon={createFacilityIcon(fac, `${town.name} ${label}`)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e as any);
                // Check if player is within town radius
                const dist = getDistance(positionRef.current[0], positionRef.current[1], town.lat, town.lng);
                if (dist > town.radius) {
                  alert(`⚓ 你必須抵達【${town.name}】附近，才能使用此設施。\n（目前距離：${Math.round(dist)} 公尺，需 ${town.radius} 公尺以內）`);
                  return;
                }
                setInitialFacility(fac);
                setInTown(town);
              }
            }}
          />
        );
      });
    });
    return layers;
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#0a0e1a] text-game-accent"><Loader2 className="animate-spin w-12 h-12" /></div>;
  }

  if (!session || !player) {
    return <AuthScreen onSignIn={() => supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        fetchProfile(session.user.id);
      }
    })} />;
  }


  // Map Component to handle clicks
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (!isTraveling && !inTown && !activePoiCombat) {
          if (!isInTaiwan(e.latlng.lat, e.latlng.lng)) {
            alert('系統偵測前方為汪洋大海或境外區域，勇者無法前往該地！');
            setPendingTarget(null);
            return;
          }
          setPendingTarget({ lat: e.latlng.lat, lng: e.latlng.lng, label: '指定座標' });
        }
      },
    });
    return null;
  };

  if (isDoubleTabbed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0e1a] text-white p-6 text-center">
        <ShieldAlert size={64} className="text-game-danger mb-6 animate-pulse" />
        <h1 className="text-2xl font-black text-game-danger mb-4">雙開偵測攔截</h1>
        <p className="text-gray-400 max-w-md leading-relaxed">
          系統偵測到您在其他分頁或視窗已經開啟了遊戲。<br />為了保護您的存檔與資源不被異常覆蓋（回檔），此視窗已被暫停操作。
        </p>
        <p className="text-sm text-game-accent mt-6 font-bold">請回到原本的視窗繼續遊戲，或者關閉本頁面。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-white overflow-hidden">

      {/* ═══════════ TOP BAR ═══════════ */}
      <div className="glass-panel px-4 py-3 flex justify-between items-center z-[1100] gap-4">
        {/* Left: Avatar + Level */}
        <div
          className="flex items-center gap-3 min-w-0 cursor-pointer hover:bg-white/5 p-1 -m-1 rounded-xl transition-colors"
          onClick={() => setActiveTab('stats')}
          title="勇者能力與裝備"
        >
          <div className="relative flex-shrink-0">
            <div className={`w-12 h-12 rounded-full border-2 bg-gradient-to-br from-game-medium to-game-dark flex items-center justify-center text-2xl ${activeGod ? 'border-amber-400 anim-god-glow' : 'border-game-gold anim-pulse-glow'}`}>
              {isTraveling ? '🚂' : isWalking ? '🏃‍♂️' : '🧙‍♂️'}
            </div>
            {activeGod && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-[#0a0e1a] shadow-lg anim-god-glow z-10">
                <span className="text-[10px]">{activeGod.avatar}</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-game-gold text-game-dark text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border border-game-dark/20">
              {player.level}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold flex items-center gap-3">
              <span className="truncate">{player.nickname || '勇者'} <span className="text-gray-500 font-normal text-xs ml-1">Lv.{player.level}</span></span>
              <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                <div className="flex items-center gap-0.5 text-[11px] font-bold text-red-400">
                  <Sword size={10} /> {effectiveAtk}
                </div>
                <div className="flex items-center gap-0.5 text-[11px] font-bold text-blue-400">
                  <Shield size={10} /> {effectiveDef}
                </div>
                <div className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-400">
                  <PlusCircle size={10} /> {effectiveHeal}
                </div>
              </div>
            </div>
            {/* HP bar */}
            <div className="flex items-center gap-2 mt-1">
              <Heart size={10} className="text-red-400 flex-shrink-0" />
              <div className="w-40 h-[6px] bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bar-hp transition-all duration-500 rounded-full" style={{ width: `${(player.hp / effectiveMaxHp) * 100}%` }} />
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums w-16 text-right">{player.hp}/{effectiveMaxHp}</span>
            </div>
            {/* MP bar */}
            <div className="flex items-center gap-2 mt-0.5">
              <div className="text-blue-400 font-black text-[10px] w-2.5 flex justify-center">M</div>
              <div className="w-40 h-[4px] bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${Math.min(100, Math.max(0, (player.mp / player.maxMp) * 100))}%` }} />
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums w-16 text-right">{player.mp}/{player.maxMp}</span>
            </div>
          </div>
        </div>

        {/* Right: Guide + Profile Menu */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 bg-game-accent/20 hover:bg-game-accent/40 text-game-accent px-3 py-1.5 rounded-full border border-game-accent/30 transition shadow-[0_0_10px_rgba(99,102,241,0.2)]"
            title="指南手冊"
          >
            <Book size={14} />
            <span className="text-xs font-bold hidden sm:inline">指南</span>
          </button>

          {/* Profile / Menu Button */}
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition shadow-lg ${isProfileMenuOpen ? 'bg-white/15 border-white/40 text-white' : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'}`}
          >
            <SettingsIcon size={14} />
            <span className="text-xs font-bold hidden sm:inline">選單</span>
          </button>

          {/* Profile Dropdown */}
          {isProfileMenuOpen && (
            <>
              <div className="fixed inset-0 z-[1099]" onClick={() => setIsProfileMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-2 z-[1100] bg-black/90 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden w-52 anim-scale-in">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-game-accent to-indigo-700 flex items-center justify-center text-lg">🧙‍♂️</div>
                  <div>
                    <div className="text-xs font-black text-white">{player.nickname || '勇者'}</div>
                    <div className="text-[10px] text-gray-500">Lv.{player.level}</div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => { setActiveTab('stats'); setIsProfileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
                  >
                    <span>🧙</span> 角色狀態
                  </button>
                  <button
                    onClick={() => { setActiveTab('ranking'); setIsProfileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
                  >
                    <Trophy size={14} /> 排行榜
                  </button>
                  <button
                    onClick={() => { setShowTreasury(true); setIsProfileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
                  >
                    <Coins size={14} /> 財庫
                  </button>
                  <div className="border-t border-white/10 mt-1 pt-1">
                    <button
                      onClick={() => { setShowUpdates(true); setIsProfileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
                    >
                      <ScrollText size={14} /> 更新內容
                    </button>
                    <button
                      onClick={() => { setShowSettings(true); setIsProfileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
                    >
                      <MapPin size={14} /> 地圖樣式
                    </button>
                    <button
                      onClick={() => supabase.auth.signOut()}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X size={14} /> 登出
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* 財庫 Modal (新) */}
      {showTreasury && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in">
          <div className="glass-panel w-full max-w-md rounded-[2.5rem] p-8 border border-white/20 shadow-2xl relative overflow-hidden anim-scale-in">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl opacity-50" />

            <div className="relative flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black text-white italic flex items-center gap-3">
                  <Coins className="text-amber-400" size={32} /> 我的財庫
                </h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Taiwanese Regional Assets</p>
              </div>
              <button
                onClick={() => setShowTreasury(false)}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* 基礎貨幣 */}
              {[
                { id: 'gold', label: '金幣 / TWD', val: Math.floor(player.gold), icon: <div className="text-2xl">💰</div>, desc: '在大台北地區通用的商業貨幣。', color: 'text-amber-400' },
                { id: 'mats', label: '建材', val: Math.floor(player.baseMaterials), icon: <div className="text-2xl">🧱</div>, desc: '用於家園建築升級的基礎工業資源。', color: 'text-orange-400' },
                { id: 'incense', label: '香火', val: player.incense, icon: <span className="text-2xl">🕯️</span>, desc: '來自全台各地廟宇的信仰力量，可用於祭祀。', color: 'text-red-400' },
                { id: 'lingQi', label: '仙草靈氣', val: player.lingQi, icon: <Sparkles className="text-emerald-400" size={24} />, desc: '山林間採集而來的純淨靈氣，對技能極為重要。', color: 'text-emerald-400' },
                { id: 'tech', label: '科技碎片', val: player.techFragments, icon: <Cpu className="text-sky-400" size={24} />, desc: '矽島科技重鎮的半導體零件，用於裝備開發。', color: 'text-sky-400' },
                { id: 'salt', label: '海鹽結晶', val: player.saltCrystals, icon: <Waves className="text-blue-300" size={24} />, desc: '西南沿海精煉的鹽晶，生活物資的關鍵。', color: 'text-blue-300' },
                { id: 'gems', label: '台灣藍寶靈石', val: player.premiumGems, icon: <Diamond className="text-indigo-400" size={24} />, desc: '花蓮礦區挖掘出的極稀有寶石。', color: 'text-indigo-400' },
              ].map(res => (
                <div key={res.id} className="flex items-center gap-4 bg-white/5 p-4 rounded-[1.5rem] border border-white/5 hover:border-white/10 transition-all group">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                    {res.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-sm font-bold text-white/90">{res.label}</span>
                      <span className={`text-xl font-mono font-black ${res.color}`}>{res.val.toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-1">{res.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowTreasury(false)}
              className="w-full mt-8 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/10 active:scale-[0.98]"
            >
              關閉視窗
            </button>
          </div>
        </div>
      )}

      {/* ─── UPDATE NOTES MODAL (新) ─── */}
      {showUpdates && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md anim-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 border border-white/20 shadow-2xl relative overflow-hidden anim-scale-in flex flex-col max-h-[90vh]">
            <div className="absolute -left-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

            <div className="relative flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                  <ScrollText className="text-blue-400" size={28} /> 更新內容
                </h2>
                <p className="text-gray-400 text-xs mt-1">持續進化的遊戲世界</p>
              </div>
              <button
                onClick={() => setShowUpdates(false)}
                className="p-2 sm:p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 relative">
              {UPDATE_NOTES.map((note, idx) => (
                <div key={idx} className="relative pl-6 sm:pl-8 pb-6 border-l-2 border-white/10 last:border-transparent last:pb-0">
                  <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] border-2 border-slate-900" />

                  <div className="mb-3">
                    <div className="flex items-baseline gap-3 mb-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-wide">{note.version}</h3>
                      <span className="text-xs text-gray-500 font-mono bg-black/30 px-2 py-0.5 rounded-md">{note.date}</span>
                    </div>
                    <div className="text-sm font-bold text-blue-300">{note.title}</div>
                  </div>

                  <ul className="space-y-2.5">
                    {note.changes.map((change, cIdx) => {
                      let tagColor = 'bg-gray-500 text-gray-100';
                      let tagLabel = '系統';
                      if (change.type === 'feature') {
                        tagColor = 'bg-blue-500 text-white';
                        tagLabel = '功能';
                      } else if (change.type === 'fix') {
                        tagColor = 'bg-red-500 text-white';
                        tagLabel = '修復';
                      } else if (change.type === 'balance') {
                        tagColor = 'bg-orange-500 text-white';
                        tagLabel = '平衡';
                      }

                      return (
                        <li key={cIdx} className="flex gap-3 text-sm text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 self-start ${tagColor} shadow-sm`}>
                            {tagLabel}
                          </span>
                          <span className="leading-snug">{change.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="shrink-0 pt-4 mt-2 border-t border-white/10 text-center">
              <p className="text-[10px] text-gray-500">感謝所有參與測試與給予建議的玩家！</p>
            </div>
          </div>
        </div>
      )}

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* ─── SETTINGS MODAL ─── */}
      {showSettings && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm anim-fade-in-up">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-gray-500/30 shadow-2xl flex flex-col relative overflow-hidden">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full glass-panel flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl">🗺️</span>
              <div>
                <h3 className="text-xl font-black text-white">地圖樣式</h3>
                <p className="text-xs text-gray-400">自訂您的視覺探索體驗</p>
              </div>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">

              {/* Map Style Section */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: '自動變化', desc: '隨天氣聰明切換' },
                    { id: '極簡白板', desc: '明亮淺色底圖' },
                    { id: '極簡黑板', desc: '純淨黑底畫面' },
                    { id: '現代航圖', desc: '戶外導航介面' },
                    { id: '街道路網', desc: '細緻街道配色' }
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => setMapStyle(style.id)}
                      className={`relative flex flex-col items-start p-3 rounded-xl border transition-all text-left overflow-hidden group ${mapStyle === style.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                        }`}
                    >
                      {mapStyle === style.id && (
                        <div className="absolute top-0 right-0 p-1">
                          <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></div>
                        </div>
                      )}
                      <span className={`font-bold text-sm mb-1 ${mapStyle === style.id ? 'text-amber-400' : 'text-gray-200'}`}>
                        {style.id}
                      </span>
                      <span className="text-[10px] text-gray-400 leading-tight">
                        {style.desc}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 italic mt-2">
                  * 「自動變化」會依據遊戲內的天氣切換最適合的底圖（晴天：航圖 / 雨天：路網 / 霧天：黑板）。
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="flex-1 relative overflow-hidden">

        {/* ─── EXPLORE ─── */}
        {activeTab === 'explore' && (
          <div className="w-full h-full relative">
            <MapContainer center={position} zoom={15} zoomControl={false} className="w-full h-full">
              {(() => {
                let targetStyle = mapStyle;
                if (targetStyle === '自動變化') {
                  if (weather === 'sunny') targetStyle = '現代航圖';
                  else if (weather === 'rainy') targetStyle = '街道路網';
                  else targetStyle = '極簡黑板'; // foggy, stormy
                }

                let url = '';
                let attribution = '';

                switch (targetStyle) {
                  case '極簡白板':
                    url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
                    attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
                    break;
                  case '極簡黑板':
                    url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
                    attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
                    break;
                  case '現代航圖':
                    url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
                    attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
                    break;
                  case '街道路網':
                    url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
                    attribution = 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, etc.';
                    break;
                  default:
                    url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
                    attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
                    break;
                }

                return <TileLayer url={url} attribution={attribution} />;
              })()}
              {townLayers}
              {poiLayers}
              {facilityLayers}
              <Marker position={position} icon={playerIcon}>
                <Popup>你的位置</Popup>
              </Marker>
              <MapClickHandler />
              <MapUpdater center={position} isTraveling={isTraveling} weather={weather} />

              {/* Target Confirmation UI (Marker Overlay to prevent jitter) */}
              {pendingTarget && pendingConfirmIcon && !isWalking && !isTraveling && (
                <Marker
                  position={[pendingTarget.lat, pendingTarget.lng]}
                  icon={pendingConfirmIcon}
                  eventHandlers={{
                    click: (e) => {
                      // Prevent map click behind the confirm card
                      L.DomEvent.stopPropagation(e as any);
                      const target = (e.originalEvent.target as HTMLElement);
                      if (target.id === 'btn-confirm-move' || target.closest('#btn-confirm-move')) {
                        setTargetPosition([pendingTarget.lat, pendingTarget.lng]);
                        setPendingTarget(null);
                      } else if (target.id === 'btn-cancel-move' || target.closest('#btn-cancel-move')) {
                        setPendingTarget(null);
                      }
                    }
                  }}
                />
              )}

              {/* Destination Marker */}
              {targetPosition && !pendingTarget && (
                <Marker position={targetPosition} icon={TARGET_ICON_SIMPLE} />
              )}

              {isTraveling && travelPath.length > 0 && (
                <Polyline
                  positions={travelPath}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 6,
                    opacity: 0.6,
                    dashArray: '10, 10',
                    lineCap: 'round',
                    className: 'railway-line'
                  }}
                />
              )}
            </MapContainer>

            {/* Top-Left Column: Location Badge + Deployed Partners */}
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none items-start">
              {/* Location & Level Badge */}
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-1.5 pointer-events-auto whitespace-nowrap">
                <MapPin size={14} className="text-game-accent flex-shrink-0" />
                <span className="text-xs font-black text-white">{areaName}</span>
                <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded-full border border-sky-400/20 tabular-nums">
                  Lv.{Math.max(1, player!.level - 2)}~{player!.level + 3}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLogOpacity(o => o === 1 ? 0.7 : o === 0.7 ? 0.3 : o === 0.3 ? 0 : 1);
                  }}
                  className="ml-1 p-1 px-1.5 text-[9px] font-bold rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                  title="日誌透明度"
                >
                  {logOpacity === 1 ? '👁️ 100%' : logOpacity === 0.7 ? '🌫️ 70%' : logOpacity === 0.3 ? '👻 30%' : '🙈 0%'}
                </button>
              </div>

              {/* Stop Movement Button */}
              {(isWalking || targetPosition) && !isTraveling && (
                <button
                  onClick={() => {
                    setTargetPosition(null);
                    setIsWalking(false);
                    walkTargetRef.current = null;
                    walkStartRef.current = null;
                    walkStartedAtRef.current = null;
                    walkDurationSecRef.current = 0;
                    saveProfileRef.current?.(); // Immediate save to clear DB
                  }}
                  className="bg-red-500/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-red-400/50 shadow-lg flex items-center gap-2 pointer-events-auto hover:bg-red-600 transition-all anim-scale-in"
                >
                  <Square size={12} fill="white" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">停止移動</span>
                </button>
              )}

              {/* Deployed Partners */}
              {player.partners.filter(p => p.isDeployed).map((p) => {
                const colors = RARITY_COLORS[p.rarity];
                return (
                  <div
                    key={p.id}
                    className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl border-2 bg-black/60 backdrop-blur-md shadow-lg transition-all ${colors ? colors.border + ' ' + colors.glow : 'border-gray-500'} ${isTraveling ? 'opacity-50 grayscale' : ''}`}
                    title={p.name}
                  >
                    {getPartnerAvatar(p.name, p.avatar)}
                    <div className="absolute -bottom-2 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-black border border-white/20 text-white shadow-sm whitespace-nowrap">
                      Lv.{p.level}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Travel Overlay (during train ride) */}
            {isTraveling && (
              <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1200] w-[90%] max-w-xs pointer-events-none anim-scale-in">
                <div className="bg-black/80 backdrop-blur-2xl p-6 rounded-3xl border border-white/20 flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                  <div className="text-3xl animate-bounce flex items-center justify-center text-game-gold shrink-0">
                    <TrainFront size={32} strokeWidth={2.5} />
                  </div>
                  <div className="w-full text-center">
                    <div className="text-xs font-black text-game-gold uppercase tracking-[0.2em] mb-1">Traveling...</div>
                    <div className="text-lg font-bold text-white mb-3">火車行駛中</div>
                    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/5 relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-game-gold to-orange-400 shadow-[0_0_15px_#fbbf24] transition-all duration-100 ease-linear rounded-full"
                        style={{ width: `${travelProgress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* ─── Weather Visual Overlays ─── */}
            {weather === 'foggy' && !hasWeatherResistance('foggy') && (
              <div className="weather-fog-overlay" />
            )}
            {(weather === 'rainy' || weather === 'stormy') && (
              <WeatherRain weather={weather as 'rainy' | 'stormy'} />
            )}
            {weather === 'stormy' && (
              <div className="weather-lightning-flash" />
            )}



            {/* Weather Overlay - Moved to Map */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-none">

              <button
                onClick={() => setIsWeatherPanelOpen(!isWeatherPanelOpen)}
                className={`flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border shadow-lg transition-all hover:bg-black/80 pointer-events-auto ${hasWeatherResistance(weather) ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : (isWeatherPanelOpen ? 'border-game-gold ring-1 ring-game-gold/50' : 'border-white/20')}`}
              >
                {hasWeatherResistance(weather) && <Shield size={14} className="text-emerald-400" />}
                <span className="text-2xl drop-shadow-md">{WEATHER_TYPES[weather].icon}</span>
                <span className="text-sm font-bold text-white drop-shadow-md">{WEATHER_TYPES[weather].label}</span>
              </button>

              {isWeatherPanelOpen && (
                <>
                  {/* Backdrop to close */}
                  <div className="fixed inset-0 z-[-1] pointer-events-auto" onClick={() => setIsWeatherPanelOpen(false)} />

                  <div className="bg-black/80 backdrop-blur-xl p-4 rounded-2xl border border-white/20 shadow-2xl w-64 anim-scale-in pointer-events-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{WEATHER_TYPES[weather].icon}</span>
                      <div>
                        <div className="font-black text-white">{WEATHER_TYPES[weather].label}</div>
                        <div className="text-[10px] text-gray-400 leading-tight">{WEATHER_TYPES[weather].description}</div>
                      </div>
                    </div>

                    {activeGod && (
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center text-xl border border-amber-400/30 anim-god-glow">
                            {activeGod.avatar}
                          </div>
                          <div>
                            <div className="text-[11px] font-black text-amber-400 italic">目前護駕：{activeGod.name}</div>
                            <div className="text-[9px] text-amber-400/60 font-bold uppercase tracking-widest">等級 Lv.{activeGod.level}</div>
                          </div>
                        </div>
                        <div className="bg-amber-400/5 rounded-xl p-2 border border-amber-400/10">
                          <div className="text-[10px] font-black text-amber-200/90 leading-relaxed">
                            {activeGod.name.includes('媽祖') && `✦ 護駕屬性：物理防禦 +${(activeGod.level * 0.5).toFixed(1)}%`}
                            {activeGod.name.includes('土地公') && `✦ 護駕屬性：生命上限 +${(activeGod.level * 0.5).toFixed(1)}%`}
                            {activeGod.name.includes('太子') && `✦ 護駕屬性：物理攻擊 +${(activeGod.level * 0.5).toFixed(1)}%`}
                            {activeGod.name.includes('玄天') && `✦ 護駕屬性：最終傷害 +${(activeGod.level * 1).toFixed(0)}%`}
                            {(activeGod.name.includes('關公') || activeGod.name.includes('關聖')) && `✦ 護駕屬性：全體屬性 +${(activeGod.level * 1).toFixed(0)}%`}
                            {activeGod.level >= 10 && <div className="text-sky-400 mt-0.5 font-black">✦ 神恩通達：無視所有惡劣天氣</div>}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">移動速度</span>
                        {hasWeatherResistance(weather) ? (
                          <span className="font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px]">已抵消</span>
                        ) : (
                          <span className={`font-bold ${WEATHER_TYPES[weather].walkSpeedMod > 1 ? 'text-emerald-400' : WEATHER_TYPES[weather].walkSpeedMod < 1 ? 'text-red-400' : 'text-white'}`}>
                            {WEATHER_TYPES[weather].walkSpeedMod > 1 ? '+' : ''}{Math.round((WEATHER_TYPES[weather].walkSpeedMod - 1) * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">感應半徑</span>
                        {hasWeatherResistance(weather) ? (
                          <span className="font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px]">已抵消</span>
                        ) : (
                          <span className={`font-bold ${WEATHER_TYPES[weather].poiRadiusMod > 1 ? 'text-emerald-400' : WEATHER_TYPES[weather].poiRadiusMod < 1 ? 'text-red-400' : 'text-white'}`}>
                            {WEATHER_TYPES[weather].poiRadiusMod > 1 ? '+' : ''}{Math.round((WEATHER_TYPES[weather].poiRadiusMod - 1) * 100)}%
                          </span>
                        )}
                      </div>
                      {WEATHER_TYPES[weather].envHpTickDmg > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">環境傷害</span>
                          {hasWeatherResistance(weather) ? (
                            <span className="font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px]">已抵消</span>
                          ) : (
                            <span className="font-bold text-red-500">每10秒 -{Math.round(WEATHER_TYPES[weather].envHpTickDmg * 100)}%</span>
                          )}
                        </div>
                      )}

                      {Object.keys(WEATHER_TYPES[weather].elementMods).length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                          <div className="text-[9px] font-black text-gray-500 uppercase mb-1.5 tracking-wider">屬性對應</div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            {Object.entries(WEATHER_TYPES[weather].elementMods).map(([elem, mod]: [any, any]) => (
                              <div key={elem} className="flex justify-between items-center text-[10px]">
                                <span className="text-gray-400 flex items-center gap-1">
                                  {ELEMENT_META[elem as ElementType]?.icon} {ELEMENT_META[elem as ElementType]?.label}
                                </span>
                                <span className={mod > 1 ? 'text-emerald-400' : 'text-red-400'}>
                                  {mod > 1 ? '+' : ''}{Math.round((mod - 1) * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Weather Sync Info */}
                      <div className="mt-4 pt-4 border-t border-white/15">
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                          <p className="text-[11px] text-gray-400 font-bold leading-relaxed text-center italic">
                            根據天氣預報顯示：<br />
                            <span className="text-white not-italic">{weatherCountdown} 後</span>，將轉為 <span className="text-game-accent not-italic">【{nextWeather ? WEATHER_TYPES[nextWeather].label : '---'}】</span> 天氣
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Right Area - Combat Logs / Stats */}
            {logOpacity > 0 && (
              <div
                className={`absolute bottom-6 z-[1000] flex flex-col gap-2 transition-all duration-500 ease-in-out pointer-events-none max-w-[calc(100vw-2rem)] w-[280px] sm:w-[320px] md:w-[380px] items-end ${isLogsExpanded ? 'right-4 sm:right-6' : '-right-[240px] sm:-right-[280px] md:-right-[340px]'}`}
                style={{ opacity: logOpacity }}
              >
                {/* Collapse/Expand Pull Tab */}
                <button
                  onClick={() => setIsLogsExpanded(!isLogsExpanded)}
                  className="absolute left-[-36px] top-1/2 -translate-y-1/2 w-9 h-9 bg-black/70 backdrop-blur-md rounded-full border border-white/20 pointer-events-auto flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-xl group hover:scale-110 active:scale-95"
                  title={isLogsExpanded ? "隱藏面板" : "展開面板"}
                >
                  <div className="flex items-center justify-center opacity-70 group-hover:opacity-100 italic font-black transition-opacity">
                    {isLogsExpanded ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                  </div>
                </button>

                {/* Toggle Button */}
                {(combatLogs.length > 0 || sessionStats.kills > 0 || autoExplore) && (
                  <div className={`flex justify-end pointer-events-auto w-full mb-0.5 transition-opacity duration-300 ${isLogsExpanded ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-black/60 backdrop-blur-md rounded-full border border-white/20 p-1 flex shadow-lg">
                      <button onClick={() => setIsStatsView(false)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${!isStatsView ? 'bg-game-gold text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>📝 戰鬥日誌</button>
                      <button onClick={() => setIsStatsView(true)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${isStatsView ? 'bg-game-gold text-black shadow-md' : 'text-gray-400 hover:text-white'}`}><TrendingUp size={12} /> 統計數據</button>
                    </div>
                  </div>
                )}

                {isStatsView ? (
                  <div className="bg-black/80 backdrop-blur-[10px] rounded-2xl border border-white/20 p-4 pointer-events-auto shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex flex-col gap-3 anim-fade-in-up w-full">
                    <div className="text-center pb-2.5 border-b border-white/10">
                      <div className="flex items-center justify-center gap-1.5 text-[11px] md:text-xs text-gray-400 tracking-wider mb-1">
                        <span className={`w-2 h-2 rounded-full ${autoExplore ? 'bg-green-500 animate-[pulse_1.5s_ease-in-out_infinite]' : 'bg-gray-500'}`}></span>
                        <span>本次掛機時長</span>
                      </div>
                      <div className="text-xl md:text-3xl font-black text-white tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] tabular-nums">{formatDuration(sessionDuration)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-1.5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-sky-500/10 rounded-full blur-xl group-hover:bg-sky-500/20 transition-all duration-500"></div>
                        <span className="text-[11px] md:text-xs text-gray-400 z-10 font-medium tracking-wide">🚀 累計經驗值</span>
                        <div className="font-bold text-sky-400 flex items-baseline gap-1.5 z-10">
                          <span className="text-xl md:text-2xl tabular-nums">{sessionStats.exp.toLocaleString()}</span>
                          <span className="text-[10px] md:text-[11px] font-normal text-sky-400/60 drop-shadow-none tabular-nums">({(sessionStats.exp / Math.max(1, sessionDuration / 60)).toFixed(0)}/min)</span>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col gap-1.5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all duration-500"></div>
                        <span className="text-[11px] md:text-xs text-gray-400 z-10 font-medium tracking-wide">💰 累計金幣</span>
                        <div className="font-bold text-game-gold flex items-baseline gap-1.5 z-10">
                          <span className="text-xl md:text-2xl tabular-nums">{sessionStats.gold.toLocaleString()}</span>
                          <span className="text-[10px] md:text-[11px] font-normal text-amber-400/60 drop-shadow-none tabular-nums">({(sessionStats.gold / Math.max(1, sessionDuration / 60)).toFixed(0)}/min)</span>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex justify-between items-center col-span-2">
                        <span className="text-[11px] md:text-xs text-gray-400 pl-1 font-medium tracking-wide">👾 總擊殺數</span>
                        <span className="font-bold text-white text-lg md:text-xl pr-1 tabular-nums">
                          {sessionStats.kills.toLocaleString()} <span className="text-[11px] md:text-xs font-normal text-rose-400 ml-1">(菁英: {sessionStats.eliteKills})</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <div className="flex-1 bg-white/5 rounded-lg px-2.5 py-2 border border-white/5 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-medium">⭐ 夥伴總經驗</span>
                        <span className="font-bold text-amber-200 tabular-nums">{sessionStats.partnerExp.toLocaleString()}</span>
                      </div>
                      <div className="flex-1 bg-white/5 rounded-lg px-2.5 py-2 border border-white/5 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-medium">🕯️ 獲得香火</span>
                        <span className="font-bold text-orange-400 tabular-nums">{sessionStats.incense.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-white/10 mt-1">
                      <div className="text-[10px] text-gray-400 mb-2 font-bold flex items-center gap-1.5 pl-1"><Package size={12} className="opacity-70" /> 戰利品清單 <span className="text-[9px] font-normal opacity-50 ml-1">(自動堆疊)</span></div>
                      {Object.keys(sessionStats.items).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1 pb-1">
                          {Object.values(sessionStats.items).map(item => (
                            <div key={item.name} className="flex items-center gap-1.5 bg-black/40 px-2 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors" title={item.name}>
                              <span className="text-sm drop-shadow-sm">{item.icon}</span>
                              <span className="text-[10px] text-white whitespace-nowrap tracking-wide">{item.name} <span className="font-black text-game-gold ml-0.5">x{item.quantity}</span></span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-[10px] text-gray-500 italic bg-black/20 rounded-lg border border-white/5 w-full">尚未獲得戰利品...</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col-reverse gap-1.5 w-full items-end max-h-[400px] overflow-y-auto custom-scrollbar pointer-events-auto pr-1">
                    {combatLogs.length > 0 ? combatLogs.map(log => (
                      <div key={log.id} className="text-[11px] md:text-[14px] font-bold px-3 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-sm flex flex-wrap items-center gap-x-2 gap-y-1 anim-fade-in-up w-fit max-w-full">
                        {log.type === 'win' ? (
                          <>
                            <span className="whitespace-nowrap">⚔️ 擊敗 {log.enemyName}</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-sky-300 whitespace-nowrap">+{log.exp} EXP</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-game-gold whitespace-nowrap">+{log.gold} 金幣</span>
                            {log.partnerExp !== undefined && log.partnerExp > 0 && (
                              <>
                                <span className="text-gray-400">|</span>
                                <span className="text-amber-300 whitespace-nowrap bg-amber-400/10 px-1 rounded border border-amber-400/20 shadow-[0_0_10px_rgba(251,191,36,0.1)] flex items-center gap-0.5">
                                  <span className="text-[10px] animate-pulse">⭐</span> 夥伴 +{log.partnerExp}
                                </span>
                              </>
                            )}
                            {log.items && log.items.length > 0 && (
                              <>
                                <span className="text-gray-400">|</span>
                                <span className="text-emerald-300">
                                  {log.items.map(i => `${i.icon}${i.name}x${i.quantity}`).join(', ')}
                                </span>
                              </>
                            )}
                          </>
                        ) : log.type === 'lose' ? (
                          <>
                            <span className="whitespace-nowrap">💀 挑戰 {log.enemyName} 失敗</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-red-400">{log.message}</span>
                          </>
                        ) : (
                          <>
                            <span className="whitespace-nowrap">{log.message}</span>
                          </>
                        )}
                      </div>
                    )) : (
                      <div className="text-[11px] font-bold px-4 py-3 bg-black/40 backdrop-blur-md rounded-xl border border-white/5 text-gray-500 italic shadow-sm w-fit anim-fade-in transition-opacity" style={{ opacity: isLogsExpanded ? 1 : 0 }}>
                        等待數據中...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Left Area - Auto Explore & Interactions */}
            {activeTab === 'explore' && !isCombatAction && !inTown && (
              <div className="absolute bottom-6 left-4 sm:left-6 z-[1000] flex flex-col gap-3 pointer-events-none items-start w-fit px-0">

                {/* Contextual Interaction Card (Shown when clicking a POI or Town nearby) */}
                {interactingLocation && (
                  <div className="w-fit sm:w-64 glass-panel p-3.5 rounded-2xl anim-fade-in-up pointer-events-auto border-t-2 border-t-game-accent/50 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-game-accent/10 to-transparent pointer-events-none"></div>
                    <div className="flex flex-col gap-3 relative z-10">
                      <div className="flex justify-between items-center bg-black/40 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-game-accent animate-pulse" />
                          <span className="font-bold text-sm text-white">
                            {interactingLocation.type === 'town' ? interactingLocation.town.name : POI_NAMES[interactingLocation.poi.type] || '未知點'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const id = interactingLocation.type === 'town' ? interactingLocation.town.id : interactingLocation.poi.id;
                            lastDismissedIdRef.current = id;
                            setInteractingLocation(null);
                          }}
                          className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>


                      <div className="flex gap-2 w-full mt-1">
                        {interactingLocation.type === 'town' ? (
                          <button onClick={() => { setInTown(interactingLocation.town); setInteractingLocation(null); }} className="flex-1 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 border border-indigo-400/30 px-3 text-[13px]">
                            <Home size={16} /> 進入城鎮
                          </button>
                        ) : (
                          <button onClick={() => executePoiInteraction(interactingLocation.poi)} className="flex-1 h-9 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 border border-emerald-400/30 px-3 text-[13px]">
                            <Compass size={16} /> 開始互動
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!isTraveling) {
                      if (!autoExplore) {
                        setSessionStartTime(Date.now());
                        setSessionDuration(0);
                        setSessionStats({ exp: 0, gold: 0, kills: 0, eliteKills: 0, partnerExp: 0, incense: 0, items: {} });
                      }
                      setAutoExplore(!autoExplore);
                    }
                  }}
                  disabled={isTraveling}
                  className={`pointer-events-auto flex items-center justify-center gap-2 w-fit px-4 py-2.5 rounded-2xl shadow-2xl transition-all border font-black tracking-widest text-[14px] backdrop-blur-xl ${isTraveling ? 'bg-black/50 border-white/10 text-gray-500 cursor-not-allowed' :
                    autoExplore
                      ? 'bg-game-accent text-white border-game-accent shadow-[0_0_20px_rgba(var(--game-accent-rgb),0.4)]'
                      : 'bg-black/60 border-white/20 text-gray-300 hover:text-white hover:bg-black/80 hover:border-white/40'
                    }`}
                >
                  <Zap size={18} fill={autoExplore && !isTraveling ? "currentColor" : "none"} className={autoExplore && !isTraveling ? 'animate-pulse' : ''} />
                  <span>{autoExplore ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* LOOT POPUP */}
        {lootMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
            <div className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-white/20 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-amber-400">{lootMessage.title}</h3>
                <button onClick={() => setLootMessage(null)} className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                {/* Exp & Gold Rewards */}
                {(lootMessage.exp && lootMessage.exp > 0) && (
                  <div className="flex items-center gap-4 bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20">
                    <div className="text-3xl drop-shadow-md">✨</div>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-indigo-300">經驗值</div>
                      <div className="text-sm text-gray-400">獲得: <span className="text-white font-bold">+{lootMessage.exp}</span></div>
                    </div>
                  </div>
                )}
                {(lootMessage.gold && lootMessage.gold > 0) && (
                  <div className="flex items-center gap-4 bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                    <div className="text-3xl drop-shadow-md">💰</div>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-amber-300">金幣</div>
                      <div className="text-sm text-gray-400">獲得: <span className="text-white font-bold">+{lootMessage.gold}</span></div>
                    </div>
                  </div>
                )}

                {lootMessage.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10">
                    <div className="text-3xl drop-shadow-md">{item.icon}</div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{item.name}</div>
                      <div className="text-sm text-gray-400">數量: <span className="text-white font-bold">+{item.quantity}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setLootMessage(null)} className="w-full mt-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors shadow-[0_0_15px_rgba(217,119,6,0.5)]">
                確認
              </button>
            </div>
          </div>
        )}

        {/* ─── PARTNERS ─── */}
        {activeTab === 'partners' && <PartnersTab player={player!} onUpdatePlayer={setPlayer as any} saveProfile={saveProfile} isCombatAction={isCombatAction} mapServerProfile={mapServerProfile} setRpcPending={(val: boolean) => { isRpcPendingRef.current = val; }} />}

        {activeTab === 'home' && <HomeTab player={player!} onUpdatePlayer={setPlayer as any} saveProfile={saveProfile} />}

        {/* ─── RANKING (排行) ─── */}
        {activeTab === 'ranking' && <RankingTab player={player!} />}

        {activeTab === 'quests' && (
          <DailyQuestPanel
            userId={session.user.id}
            onClose={() => setActiveTab('explore')}
            cityId={inTown?.id}
            onQuestsStatusUpdate={setHasQuestReward}
            onReward={(gold, exp, currency) => {
              const CURR_MAP: any = {
                lingQi: { name: '仙草靈氣', icon: '🌿' },
                techFragments: { name: '科技碎片', icon: '⚙️' },
                incense: { name: '香火', icon: '🕯️' },
                saltCrystals: { name: '海鹽結晶', icon: '🌊' },
                premiumGems: { name: '台灣藍寶靈石', icon: '💎' }
              };

              const rewardItems = [];
              if (currency) {
                const info = CURR_MAP[currency.type] || { name: currency.type, icon: '💎' };
                rewardItems.push({ name: info.name, quantity: currency.amount, icon: info.icon });
              }

              // 彈出獲取獎勵視窗
              setLootMessage({
                title: '📜 任務委託達成！',
                gold: gold,
                exp: exp,
                items: rewardItems
              });

              setPlayer(prev => {
                if (!prev) return null;
                const updated = {
                  ...prev,
                  gold: prev.gold + gold,
                  exp: prev.exp + exp,
                  ...(currency ? { [currency.type]: (prev[currency.type as keyof typeof prev] as number || 0) + currency.amount } : {})
                };
                saveProfile(updated);
                return updated;
              });
            }}
          />
        )}

        {/* ─── STATS (勇者) ─── */}
        {
          activeTab === 'stats' && (
            <div className="p-5 h-full overflow-y-auto w-full space-y-5 flex flex-col">
              <div className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-indigo-900/20 to-transparent border border-white/10 flex flex-col md:flex-row gap-6 items-center">
                <div className="relative group">
                  <div className="absolute inset-0 bg-game-accent/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                  <div className="w-24 h-24 rounded-3xl border-2 border-game-accent bg-slate-900 flex items-center justify-center text-5xl relative z-10 shadow-2xl">
                    🧙‍♂️
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col items-center md:items-start">
                    <div className="flex items-center gap-3">
                      {isEditingNickname ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tempNickname}
                            onChange={(e) => setTempNickname(e.target.value)}
                            className="bg-black/40 border border-game-accent/50 rounded-lg px-3 py-1 text-white font-bold outline-none focus:border-game-accent w-40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNickname();
                              if (e.key === 'Escape') setIsEditingNickname(false);
                            }}
                          />
                          <button onClick={handleSaveNickname} className="text-game-accent hover:text-white transition-colors">
                            <PlusCircle size={20} />
                          </button>
                        </div>
                      ) : (
                        <h2 className="text-2xl font-black flex items-center gap-2">
                          {player.nickname || '勇者'}
                          <button
                            onClick={() => {
                              setTempNickname(player.nickname || '勇者');
                              setIsEditingNickname(true);
                            }}
                            className="text-gray-500 hover:text-game-accent transition-colors p-1"
                          >
                            <SettingsIcon size={16} />
                          </button>
                        </h2>
                      )}
                      <span className="text-sm text-game-accent font-bold bg-game-accent/15 px-3 py-1 rounded-full border border-game-accent/30 tracking-tight">Lv.{player.level}</span>
                    </div>
                    {/* UID Display */}
                    <div className="flex items-center gap-2 mt-1 px-1.5 py-0.5 bg-white/5 rounded-lg border border-white/5 group/uid">
                      <span className="text-[11px] font-mono text-gray-500 uppercase tracking-tight">UID:</span>
                      <span className="text-[11px] font-mono font-bold text-gray-300">{player.uid || '--------'}</span>
                      <button
                        onClick={() => {
                          if (player.uid) {
                            navigator.clipboard.writeText(player.uid);
                            setCopiedUid(true);
                            setTimeout(() => setCopiedUid(false), 2000);
                          }
                        }}
                        className="p-1 text-gray-500 hover:text-game-accent transition-colors"
                        title="複製 UID"
                      >
                        {copiedUid ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="group-hover/uid:scale-110" />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white/5 text-sm uppercase text-gray-400 font-bold border-b border-white/5">
                        <tr>
                          <th className="px-4 py-2 font-black">屬性與說明</th>
                          <th className="px-4 py-2 font-black text-right">數值</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-300 font-bold mb-1"><TrendingUp size={14} className="text-game-accent" /> 經驗進度</div>
                            <div className="text-[12px] text-gray-500 font-normal leading-relaxed">當前獲得的經驗點數，集滿後可提升等級。</div>
                            <div className="mt-2 w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full bg-gradient-to-r from-game-accent to-indigo-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (player.exp / player.maxExp) * 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-300 text-sm text-right whitespace-nowrap">
                            <div className="text-base text-white">{player.exp.toLocaleString()} / {player.maxExp.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-500 font-bold tracking-tight">{((player.exp / player.maxExp) * 100).toFixed(2)}%</div>
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-300 font-bold mb-1"><Sword size={14} className="text-red-400" /> 攻擊力</div>
                            <div className="text-[12px] text-gray-500 font-normal leading-relaxed">決定對魔物造成的基礎傷害量，受武器與夥伴加成。</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-red-400 text-lg text-right whitespace-nowrap">{effectiveAtk}</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-300 font-bold mb-1"><Shield size={14} className="text-blue-400" /> 物理防禦</div>
                            <div className="text-[12px] text-gray-500 font-normal leading-relaxed">抵消魔物的攻擊傷害，減少探險過程中的體力損耗。</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-blue-400 text-lg text-right whitespace-nowrap">{effectiveDef}</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-300 font-bold mb-1"><Heart size={14} className="text-red-400" /> 生命上限</div>
                            <div className="text-[12px] text-gray-500 font-normal leading-relaxed">勇者的最大體力承載量，提升等級或裝備可增加。</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-red-400 text-lg text-right whitespace-nowrap">{effectiveMaxHp}</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-gray-300 font-bold mb-1"><PlusCircle size={14} className="text-emerald-400" /> 治癒能力</div>
                            <div className="text-[12px] text-gray-500 font-normal leading-relaxed">戰鬥中每回合自動恢復的生命值，由輔助型夥伴提供。</div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-400 text-lg text-right whitespace-nowrap">{effectiveHeal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* My Skills */}
              <div className="glass-panel p-5 rounded-3xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Book size={18} className="text-game-accent" /> 我的技能</h3>
                {player.skills.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 italic bg-black/10 rounded-2xl border border-dashed border-white/5">
                    目前尚未領悟任何技能...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {player.skills.map(playerSkill => {
                      const skInfo = SKILL_DATABASE.find(s => s.id === playerSkill.id);
                      if (!skInfo) return null;
                      const upgrade = getSkillUpgradeInfo(playerSkill.level);
                      const currentPower = skInfo.basePower + (playerSkill.level - 1) * skInfo.powerGrowth;
                      const currentMpCost = skInfo.baseMpCost + (playerSkill.level - 1) * skInfo.mpCostGrowth;

                      return (
                        <div key={playerSkill.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl filter drop-shadow-md">{skInfo.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-white flex gap-2 items-center">
                                {skInfo.name} <span className="text-game-accent text-xs">Lv.{playerSkill.level}</span>
                              </div>
                              <div className="text-[11px] text-gray-400 truncate mt-1">{skInfo.description}</div>
                              {skInfo.debuff && (
                                <div className="text-[10px] text-game-accent mt-1 p-1.5 bg-game-accent/5 rounded border border-game-accent/10 whitespace-normal">
                                  {skInfo.debuff.type === 'reflect' ? '🛡️' : skInfo.debuff.type === 'regen' ? '💚' : '💢'}
                                  附有【{
                                    { burn: '持續燃燒', freeze: '持續凍傷', rend: '持續撕裂', shock: '持續電擊', reflect: '反射傷害', regen: '每回合自動恢復HP' }[skInfo.debuff.type] || '狀態'
                                  }效果】：
                                  {skInfo.debuff.baseChance + (playerSkill.level - 1) * skInfo.debuff.chanceGrowth}% 機率觸發，
                                  {skInfo.debuff.baseDamage + (playerSkill.level - 1) * skInfo.debuff.damageGrowth}{skInfo.debuff.type === 'reflect' ? '%' : '點'}
                                  持續 {Math.floor(skInfo.debuff.baseDuration + (playerSkill.level - 1) * skInfo.debuff.durationGrowth)} 回合
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-black tracking-tighter text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20 mb-1">
                                消耗 {currentMpCost} MP
                              </div>
                              {skInfo.durationTurns && !skInfo.debuff ? (
                                <div className="text-[10px] font-black tracking-tighter text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                                  持續 {skInfo.durationTurns} 回合
                                </div>
                              ) : null}
                              {skInfo.type !== 'buff' && (
                                <div className="text-[10px] font-black tracking-tighter text-game-accent bg-game-accent/10 px-2 py-0.5 rounded border border-game-accent/20">
                                  威力 {currentPower}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Upgrade Section */}
                          {upgrade ? (
                            <div className="mt-2 pt-3 border-t border-white/10 flex items-center justify-between">
                              <div className="flex gap-3 text-[11px]">
                                <span className={playerSkill.fragments >= upgrade.fragments ? "text-emerald-400" : "text-red-400"}>
                                  碎片: {playerSkill.fragments}/{upgrade.fragments}
                                </span>
                                <span className={player.gold >= upgrade.gold ? "text-game-gold" : "text-red-400"}>
                                  💰 {upgrade.gold}
                                </span>
                                <span className="text-gray-400">成功率 {upgrade.successRate}%</span>
                              </div>
                              <button
                                onClick={() => handleUpgradeSkill(playerSkill.id)}
                                disabled={playerSkill.fragments < upgrade.fragments || player.gold < upgrade.gold}
                                className="bg-game-accent/20 hover:bg-game-accent/40 disabled:opacity-30 disabled:hover:bg-game-accent/20 text-game-accent px-3 py-1 rounded text-xs font-bold transition-colors"
                              >
                                升級
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 pt-3 border-t border-white/10 text-center text-[11px] text-gray-500 font-bold">
                              已達最大等級 (Lv.MAX)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        }

        {/* ─── BAG (行囊) ─── */}
        {
          activeTab === 'bag' && (
            <div className="p-5 h-full overflow-y-auto w-full space-y-5">
              {/* Equipment Slots */}
              <div className="glass-panel rounded-2xl p-6 relative">
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-game-accent/5 rounded-full blur-3xl" />
                </div>
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">⚔️ 當前裝備</h3>
                <div className="grid grid-cols-5 gap-3">
                  {(['weapon', 'armor', 'helmet', 'boots', 'accessory'] as const).map(slot => {
                    const slotKey = `equipped${slot.charAt(0).toUpperCase() + slot.slice(1)}` as keyof CharacterStats;
                    const eq = player[slotKey] as Equipment | undefined;
                    const r = eq ? RARITY_COLORS[eq.rarity] : null;
                    return (
                      <div key={slot} className="tooltip-wrap" onClick={() => eq && unequipItem(slot)}>
                        <div className={`inv-slot ${r ? `border-2 ${r.border} ${r.bg} ${r.glow} cursor-pointer` : ''}`}>
                          {eq ? <span className="text-3xl">{EQUIPMENT_DATABASE.find(e => e.id === eq.id)?.icon ?? eq.icon}</span> : <span className="text-gray-600 text-[10px] font-bold uppercase tracking-tighter">{slot === 'weapon' ? '武器' : slot === 'armor' ? '護甲' : slot === 'helmet' ? '頭盔' : slot === 'boots' ? '鞋子' : '飾品'}</span>}
                        </div>
                        {eq && (
                          <div className="tooltip-text">
                            <div className={`font-bold ${r?.text}`}>{eq.name}</div>
                            <div className="text-gray-400 text-[11px]">{eq.description}</div>
                            <div className="mt-1 text-[11px] space-x-2">
                              {eq.attack > 0 && <span className="text-red-400">ATK +{eq.attack}</span>}
                              {eq.defense > 0 && <span className="text-blue-400">DEF +{eq.defense}</span>}
                              {eq.hp > 0 && <span className="text-green-400">HP +{eq.hp}</span>}
                            </div>
                            <div className="mt-2 text-[10px] text-game-accent font-bold">點擊脫下</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unequipped Equipment */}
              {player.equipment.length > 0 && (
                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="text-base font-bold mb-4 flex items-center gap-2">🎒 背包裝備</h3>
                  <div className="flex flex-wrap gap-3">
                    {player.equipment.map((eq, index) => {
                      const r = RARITY_COLORS[eq.rarity];
                      return (
                        <div key={`${eq.id}-${index}`} className="tooltip-wrap" onClick={() => equipItem(eq)}>
                          <div className={`inv-slot border-2 ${r.border} ${r.bg} ${r.glow} cursor-pointer hover:scale-105 transition-transform`}>
                            <span className="text-3xl">{EQUIPMENT_DATABASE.find(e => e.id === eq.id)?.icon ?? eq.icon}</span>
                          </div>
                          <div className="tooltip-text">
                            <div className={`font-bold ${r.text}`}>{eq.name}</div>
                            <div className="text-gray-400 text-[11px] font-bold uppercase">{r.label} · {eq.slot === 'weapon' ? '武器' : eq.slot === 'armor' ? '護甲' : eq.slot === 'helmet' ? '頭盔' : eq.slot === 'boots' ? '鞋子' : '飾品'}</div>
                            <div className="mt-1 text-[11px] space-x-2">
                              {eq.attack > 0 && <span className="text-red-400">ATK +{eq.attack}</span>}
                              {eq.defense > 0 && <span className="text-blue-400">DEF +{eq.defense}</span>}
                              {eq.hp > 0 && <span className="text-green-400">HP +{eq.hp}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="glass-panel rounded-2xl p-5 mb-10">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">🧪 道具行李</h3>
                {player.items.length === 0 ? (
                  <div className="text-center text-gray-500 py-8 text-sm">背包空空如也…去探索看看吧！</div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {player.items.map(item => {
                      const itemDef = ITEM_DATABASE.find(id => id.id === item.id);
                      const description = item.description || itemDef?.description || '普通道具';
                      return (
                        <div key={item.id} className="tooltip-wrap" onClick={() => {
                          if (item.type === 'potion' || item.type === 'consumable') {
                            setBatchUseItem(item);
                            setBatchAmount(1);
                          }
                        }}>
                          <div className={`inv-slot ${(item.type === 'potion' || item.type === 'consumable') ? 'cursor-pointer hover:ring-2 hover:ring-game-accent/50' : 'opacity-80'}`}>
                            <span className="text-2xl">{itemDef?.icon ?? item.icon}</span>
                            <span className="inv-qty">×{item.quantity}</span>
                          </div>
                          <div className="tooltip-text">
                            <div className="font-bold">{item.name}</div>
                            <div className="text-gray-400 text-[11px]">{description}</div>
                            {(item.type === 'potion' || item.type === 'consumable') && <div className="mt-1 text-[10px] text-game-accent font-bold">點擊使用 / 批次使用</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Batch Use Modal */}
              {batchUseItem && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm anim-fade-in">
                  <div className="glass-panel w-full max-w-xs rounded-3xl p-6 border border-white/20 shadow-2xl scale-110">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">使用道具</h3>
                    <div className="flex items-center gap-4 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="text-4xl">{batchUseItem.icon}</div>
                      <div>
                        <div className="font-bold text-white">{batchUseItem.name}</div>
                        <div className="text-[10px] text-gray-400">目前持有: {batchUseItem.quantity}</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                          <span>選擇數量</span>
                          <span className="text-game-accent font-bold">{batchAmount} / {batchUseItem.quantity}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max={batchUseItem.quantity}
                          value={batchAmount}
                          onChange={(e) => setBatchAmount(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-game-accent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setBatchUseItem(null)}
                          className="py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-sm transition-all"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleBatchUseItem}
                          className="py-3 rounded-xl bg-gradient-to-r from-game-accent to-indigo-500 text-white font-bold text-sm shadow-lg shadow-game-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                          確認使用
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        }

        {/* Combat Overlay */}
        {
          isCombatAction && currentEnemy && (
            <CombatScreen
              player={{
                ...player,
                attack: effectiveAtk,
                // Rainy slightly lowers player defense, unless resistant
                defense: (weather === 'rainy' && !hasWeatherResistance('rainy')) ? Math.max(0, effectiveDef - 2) : effectiveDef,
                maxHp: effectiveMaxHp,
                heal: effectiveHeal
              }}
              enemy={currentEnemy}
              weather={weather}
              hasWeatherResistance={hasWeatherResistance}
              isMinimized={isCombatMinimized}
              onMaximize={() => setActiveTab('explore')}
              onMinimize={() => setIsCombatMinimized(true)}
              onWin={(exp: number, gold: number, skill?: Skill, loot?: GameItem[], eq?: Equipment, finalHp?: number, finalMp?: number) => {
                handleCombatWin(exp, gold, skill, loot, eq, finalHp, finalMp);
              }}
              onLose={(finalHp?: number, finalMp?: number) => {
                handleCombatLose(finalHp, finalMp);
              }}
              onFlee={() => { setIsCombatAction(false); setAutoExplore(false); }}
              autoExplore={autoExplore}
              onAutoHeal={() => {
                const pot = player.items.find(i => i.type === 'potion' && i.id !== 'item_revive_pot');
                if (pot) useItem(pot, true);
              }}
              onRevive={() => {
                const revivePot = player.items.find(i => i.id === 'item_revive_pot');
                if (revivePot) useItem(revivePot, true);
              }}
              onUseItem={(it: GameItem) => useItem(it, true)}
            />
          )
        }

        {/* Merchant Shop Overlay */}
        {
          isMerchantOpen && (
            <div className="absolute inset-0 z-[2500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm anim-fade-in-up">
              <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-amber-400 flex items-center gap-2">👳‍♂️ 流浪商人商店</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">珍稀物資收購中</p>
                  </div>
                  <button onClick={async () => {
                    setIsMerchantOpen(false);
                    if (activeMerchantPoiRef.current) {
                      const poiId = activeMerchantPoiRef.current;
                      await supabase.rpc('resolve_poi_combat', { p_poi_id: poiId, p_win: true });
                      setPois(prev => prev.filter(p => p.id !== poiId));
                      activeMerchantPoiRef.current = null;
                    }
                  }} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 mb-4">
                  <div className="text-2xl">💰</div>
                  <div>
                    <div className="text-[10px] text-amber-400 font-bold">你的資金</div>
                    <div className="text-lg font-mono font-bold">{Math.floor(player.gold)} <span className="text-xs font-sans">金幣</span></div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  <p className="text-xs font-bold text-gray-400 mb-2 px-1">你可以販售以下獲得的物品：</p>
                  {player.items.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 italic text-sm">背包空空如也...</div>
                  ) : (
                    player.items.map(item => {
                      let sellPrice = 10;
                      if (item.type === 'gem') sellPrice = 200;
                      if (item.type === 'material') sellPrice = 15;
                      if (item.type === 'potion') sellPrice = 50;
                      if (item.id === 'item_revive_pot') sellPrice = 500;

                      return (
                        <div key={item.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                          <div className="text-3xl bg-white/5 w-12 h-12 rounded-xl flex items-center justify-center border border-white/10">{ITEM_DATABASE.find(i => i.id === item.id)?.icon ?? item.icon}</div>
                          <div className="flex-1">
                            <div className="font-bold text-sm">{item.name}</div>
                            <div className="text-[10px] text-gray-500">持有: {item.quantity}</div>
                          </div>
                          <button
                            onClick={() => handleSellItem(item)}
                            className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-500/20"
                          >
                            <span className="font-mono">{sellPrice}</span> 金幣 販售
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={async () => {
                    setIsMerchantOpen(false);
                    if (activeMerchantPoiRef.current) {
                      const poiId = activeMerchantPoiRef.current;
                      await supabase.rpc('resolve_poi_combat', { p_poi_id: poiId, p_win: true });
                      setPois(prev => prev.filter(p => p.id !== poiId));
                      activeMerchantPoiRef.current = null;
                    }
                  }}
                  className="w-full mt-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/10 active:scale-95"
                >
                  結束交易
                </button>
              </div>
            </div>
          )
        }

        {/* Town Overlay */}
        {
          inTown && (
            <TownScreen
              town={inTown}
              player={player!}
              userId={session.user.id}
              onLeave={() => { setInTown(null); setInitialFacility(null); }}
              onCraftAlchemy={handleCraftAlchemy}
              onCraftEquipment={handleCraftEquipment}
              onTravel={handleTravel}
              onSellEquipment={handleSellEquipment}
              forgingRecipeId={forgingRecipeId}
              initialFacility={initialFacility}
            />
          )
        }
      </div >

      {/* ═══════════ BOTTOM NAV ═══════════ */}
      < div className="glass-panel px-2 py-2 flex justify-around items-center z-[1100]" >
        {
          [
            { key: 'explore', icon: <Compass size={22} />, label: '探索' },
            {
              key: 'quests', icon: (
                <div className="relative">
                  <ScrollText size={22} />
                  {hasQuestReward && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black/50 text-[7px] font-black text-white items-center justify-center leading-none">!</span>
                    </span>
                  )}
                </div>
              ), label: '任務'
            },
            { key: 'partners', icon: <Users size={22} />, label: '夥伴' },
            { key: 'home', icon: <Home size={22} />, label: '家園' },
            { key: 'bag', icon: <Package size={22} />, label: '行囊' },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'quests') {
                  // We'll re-check inside the panel, or we can leave it for now
                }
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${activeTab === tab.key ? 'text-game-accent bg-game-accent/10 scale-105' : 'text-gray-500 hover:text-gray-300'}`}>
              <div className={`transition-transform duration-300 ${activeTab === tab.key ? '-translate-y-1' : ''}`}>
                {tab.icon}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))
        }
      </div >
      {/* Onboarding Welcome Modal */}
      {
        showOnboarding && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm anim-fade-in">
            <div className="glass-panel w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 border border-white/20 shadow-2xl relative overflow-hidden anim-scale-in">
              {/* Background Accent */}
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-game-accent/10 rounded-full blur-3xl" />
              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-game-gold/10 rounded-full blur-3xl" />

              <div className="relative">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-game-accent to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-game-accent/20 rotate-3">
                    <Compass size={44} className="text-white animate-pulse" />
                  </div>
                </div>

                <h2 className="text-3xl font-black text-white text-center mb-2 italic">✨ 歡迎來到《浪跡戰域》 ✨</h2>
                <p className="text-gray-400 text-center text-sm mb-8 leading-relaxed">
                  在這裡，現實與魔幻的地貌交錯。你將扮演一名失去記憶的冒險者，在這個以真實地理為藍本的奇幻島嶼上展開史詩旅程！
                </p>

                <div className="space-y-5 mb-10 text-sm">
                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-game-accent/20 transition-colors">
                      <MapPin size={20} className="text-game-accent" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-0.5">🌍 探索與生存</h4>
                      <p className="text-gray-400 leading-snug">點擊地圖在地圖上移動。靠近標記去搜括寶藏或挑戰魔物獲取經驗金幣！</p>
                    </div>
                  </div>

                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-game-gold/20 transition-colors">
                      <Sword size={20} className="text-game-gold" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-0.5">⚒️ 資源與鍛造</h4>
                      <p className="text-gray-400 leading-snug">收集的素材可回城鎮進行鍛造。**每個城市都有獨特專屬的夢幻裝備！**</p>
                    </div>
                  </div>

                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-400/20 transition-colors">
                      <TrainFront size={20} className="text-sky-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-0.5">🚂 城市鐵路</h4>
                      <p className="text-gray-400 leading-snug">前往各大城鎮的「火車站」，支付金幣即可快速且精準地跨城市移動！</p>
                    </div>
                  </div>

                  <div className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                      <Users size={20} className="text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-0.5">🤝 命運契約</h4>
                      <p className="text-gray-400 leading-snug">遭遇強敵時，可於選單進行「命運契約」，招募靈魂夥伴並肩作戰！</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCloseOnboarding}
                  className="w-full bg-gradient-to-r from-game-accent to-indigo-600 hover:from-game-accent/80 hover:to-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-game-accent/20 active:scale-[0.98] flex items-center justify-center gap-2 group"
                >
                  準備好開始你的傳奇了嗎？
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
