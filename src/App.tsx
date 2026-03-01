import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Sword, Home, Users, Package, Settings as SettingsIcon, Book, Heart, Shield, Zap, ChevronRight, MapPin, Loader2, X, PlusCircle, ShieldAlert, TrainFront, Coins, Sparkles, Cpu, Flame, Waves, Diamond, Trophy, Copy, Check } from 'lucide-react';
import type { CharacterStats, Equipment, GameItem, Skill, MapPOI, Town, WeatherType, Enemy, AlchemyRecipe, BlacksmithRecipe } from './types/game';
import { MONSTER_DATABASE, SKILL_DATABASE, ITEM_DATABASE, EQUIPMENT_DATABASE, RARITY_COLORS, WEATHER_TYPES, getRegionByCityName, getRegionalMaterials, getRegionByCoordinates, TOWN_DATABASE, getPartnerAvatar, getRailwayPath, POI_NAMES } from './types/game';
import { CombatScreen } from './components/CombatScreen';
import { PartnersTab } from './components/PartnersTab';
import { HomeTab } from './components/HomeTab';
import { AuthScreen } from './components/AuthScreen';
import { TownScreen } from './components/TownScreen';
import { GuideModal } from './components/GuideModal';
import RankingTab from './components/RankingTab';
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
      ` : ''}
      <div class="relative text-3xl drop-shadow-lg ${godAvatar ? 'anim-god-glow' : ''}">${emoji}</div>
    </div>
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

const createCityLabelIcon = (name: string) => L.divIcon({
  html: `
    <div class="flex flex-col items-center">
      <div class="px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black text-white shadow-xl shadow-black/50 whitespace-nowrap">
        ${name}
      </div>
    </div>
  `,
  className: 'city-label-icon',
  iconSize: [60, 20],
  iconAnchor: [30, -5]
});

const createConfirmIcon = (label: string) => L.divIcon({
  html: `
    <div class="relative flex flex-col items-center group pointer-events-auto">
      <!-- Floating Card Confirm UI (Mainstream Design) -->
      <div class="absolute bottom-10 flex flex-col items-center anim-fade-in-up">
        <div class="bg-black/95 backdrop-blur-2xl border border-game-accent/50 rounded-2xl p-2 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2 min-w-[150px]">
          <div class="text-[9px] font-black text-game-accent uppercase tracking-[0.2em] mb-0.5 opacity-80">${label}</div>
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
      <!-- Pin -->
      <div class="text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] anim-pulse-slow">📍</div>
    </div>
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

function MapUpdater({ center, isTraveling }: { center: [number, number], isTraveling: boolean }) {
  const map = useMap();
  const lastCenterRef = React.useRef<[number, number] | null>(null);

  useEffect(() => {
    if (isTraveling) {
      map.setZoom(11); // County level zoom
    } else {
      map.setZoom(15); // Street/City level zoom
    }
  }, [isTraveling, map]);

  useEffect(() => {
    // Only setView if center changed significantly or is first run
    // This avoids sub-pixel jitter during smooth movement
    const threshold = 0.000001;
    const latDiff = lastCenterRef.current ? Math.abs(center[0] - lastCenterRef.current[0]) : 1;
    const lngDiff = lastCenterRef.current ? Math.abs(center[1] - lastCenterRef.current[1]) : 1;

    if (latDiff > threshold || lngDiff > threshold) {
      map.setView(center, map.getZoom(), { animate: false });
      lastCenterRef.current = center;
    }
  }, [center, map]);
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

const totalEquipAtk = (p: CharacterStats) => [p.equippedWeapon, p.equippedArmor, p.equippedHelmet, p.equippedBoots, p.equippedAccessory].reduce((s, e) => s + (e?.attack ?? 0), 0);
const totalEquipDef = (p: CharacterStats) => [p.equippedWeapon, p.equippedArmor, p.equippedHelmet, p.equippedBoots, p.equippedAccessory].reduce((s, e) => s + (e?.defense ?? 0), 0);
const totalEquipHp = (p: CharacterStats) => [p.equippedWeapon, p.equippedArmor, p.equippedHelmet, p.equippedBoots, p.equippedAccessory].reduce((s, e) => s + (e?.hp ?? 0), 0);

// Partner Stat Bonuses (Only counts deployed partners)
const totalPartnerAtk = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'dps' ? pt.power : Math.floor(pt.power * 0.2)), 0);
const totalPartnerDef = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'tank' ? Math.floor(pt.power * 0.5) : Math.floor(pt.power * 0.1)), 0);
const totalPartnerHp = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'tank' || pt.role === 'healer' ? pt.power * 3 : pt.power), 0);
const totalPartnerHeal = (p: CharacterStats) => p.partners.filter(pt => pt.isDeployed).reduce((s, pt) => s + (pt.role === 'healer' ? pt.power : 0), 0);

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
  type: 'win' | 'lose';
  enemyName: string;
  exp?: number;
  gold?: number;
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

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [player, setPlayer] = useState<CharacterStats | null>(null);
  const playerRef = React.useRef<CharacterStats | null>(player);
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
  const lastSafePositionRef = React.useRef<[number, number]>([25.0330, 121.5654]); // 紀錄最後在陸地的安全座標
  const [lootMessage, setLootMessage] = useState<{ title: string; items: { name: string; quantity: number; icon: string }[] } | null>(null);

  const [activePoiCombat, setActivePoiCombat] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ lat: number, lng: number, label: string } | null>(null);
  const [isMerchantOpen, setIsMerchantOpen] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [isDoubleTabbed, setIsDoubleTabbed] = useState(false);
  const isDoubleTabbedRef = React.useRef(isDoubleTabbed);
  useEffect(() => { isDoubleTabbedRef.current = isDoubleTabbed; }, [isDoubleTabbed]);
  const [showGuide, setShowGuide] = useState(false);
  const [mySessionId] = useState(() => crypto.randomUUID());
  const activePoiRef = React.useRef<string | null>(null);
  const activeMerchantPoiRef = React.useRef<string | null>(null);
  useEffect(() => { activePoiRef.current = activePoiCombat; }, [activePoiCombat]);
  const [eliteCooldowns, setEliteCooldowns] = useState<Record<string, number>>({});
  const [combatLogs, setCombatLogs] = useState<CombatLog[]>([]);
  const [logOpacity, setLogOpacity] = useState(1);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [showTreasury, setShowTreasury] = useState(false);

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

  // Sync ref structure
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

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

        // No need for immediate saveProfileRef.current?.(); 
        // The setPosition above will trigger the auto-save useEffect naturally.
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

    if (dist > 0.01) { // Approx 1km movement
      fetchPois();
      lastFetchedPosRef.current = position;
    }
  }, [position, isTraveling, isWalking, fetchPois]);



  // Weather cycle logic
  useEffect(() => {
    const rollWeather = () => {
      const types: WeatherType[] = ['sunny', 'sunny', 'sunny', 'rainy', 'rainy', 'foggy', 'stormy'];
      setWeather(types[Math.floor(Math.random() * types.length)]);
    };
    const weatherTimer = setInterval(rollWeather, 180000); // 3 minutes
    rollWeather();
    return () => clearInterval(weatherTimer);
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
          // SERVER SIDE ANTI DOUBLE TAB: If session_id in DB is different from ours, block this tab.
          if (data.session_id && data.session_id !== mySessionId) {
            setIsDoubleTabbed(true);
            return;
          }
          // Only update if it's not the current player state (basic check via updated_at or just update to be sure)
          setPlayer({
            nickname: data.nickname,
            level: data.level, exp: data.exp, maxExp: data.max_exp,
            hp: data.hp, maxHp: data.max_hp, mp: data.mp ?? 50, maxMp: data.max_mp ?? (40 + (data.level * 10)), attack: data.attack, defense: data.defense,
            gold: data.gold, baseMaterials: data.base_materials,
            lingQi: data.ling_qi ?? 0,
            techFragments: data.tech_fragments ?? 0,
            incense: data.incense ?? 0,
            saltCrystals: data.salt_crystals ?? 0,
            premiumGems: data.premium_gems ?? 0,
            buildings: data.buildings || [],
            equipment: data.equipment || [],
            equippedWeapon: data.equipped_weapon,
            equippedArmor: data.equipped_armor,
            equippedHelmet: data.equipped_helmet,
            equippedBoots: data.equipped_boots,
            equippedAccessory: data.equipped_accessory,
            items: data.items || [],
            skills: (data.skills || []).map((s: any) => ({
              id: s.id,
              level: s.level ?? 1,
              fragments: s.fragments ?? 0
            })),
            partners: data.partners || [],
            gods: data.gods || [],
            activeGodId: data.active_god_id,
            uid: data.uid,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      // Decode json fields if they were stored as JSON strings or raw objects
      setPlayer({
        nickname: data.nickname,
        level: data.level, exp: data.exp, maxExp: data.max_exp,
        hp: data.hp, maxHp: data.max_hp, mp: data.mp ?? 50, maxMp: data.max_mp ?? (40 + (data.level * 10)), attack: data.attack, defense: data.defense,
        gold: data.gold, baseMaterials: data.base_materials,
        lingQi: data.ling_qi ?? 0,
        techFragments: data.tech_fragments ?? 0,
        incense: data.incense ?? 0,
        saltCrystals: data.salt_crystals ?? 0,
        premiumGems: data.premium_gems ?? 0,
        buildings: data.buildings || [],
        equipment: data.equipment || [],
        equippedWeapon: data.equipped_weapon,
        equippedArmor: data.equipped_armor,
        equippedHelmet: data.equipped_helmet,
        equippedBoots: data.equipped_boots,
        equippedAccessory: data.equipped_accessory,
        items: data.items || [],
        skills: (data.skills || []).map((s: any) => ({
          id: s.id,
          level: s.level ?? 1,
          fragments: s.fragments ?? 0
        })),
        partners: data.partners || [],
        gods: data.gods || [],
        activeGodId: data.active_god_id,
        uid: data.uid,
      });

      // NEW TAB WINS: Claim the session for ourself unconditionally
      supabase.from('profiles').update({ session_id: mySessionId }).eq('id', userId).then();
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

    // Restore walk state from DB if present
    if (data && data.walk_target_lat && data.walk_target_lng && data.walk_started_at && data.walk_start_lat && data.walk_start_lng && !data.travel_path) {
      const targetLat: number = data.walk_target_lat;
      const targetLng: number = data.walk_target_lng;
      const startLat: number = data.walk_start_lat;
      const startLng: number = data.walk_start_lng;
      const startedAt = new Date(data.walk_started_at);
      const elapsedSec = (Date.now() - startedAt.getTime()) / 1000;

      const dLat = targetLat - startLat;
      const dLng = targetLng - startLng;
      const dist = Math.hypot(dLat, dLng);
      // Speed is ~0.00008 lat/lng units per frame (assuming 60fps = ~0.0048 per sec limit)
      // Actually walking is 0.00008 hypot distance per frame ~ 0.0048 per second
      const speedPerSec = 0.0048;
      const durationSec = dist / speedPerSec;

      if (elapsedSec >= durationSec) {
        // Arrived at walking target while offline
        setPosition([targetLat, targetLng]);
        setTargetPosition(null);
        setIsWalking(false);
        walkTargetRef.current = null;
        walkStartRef.current = null;
        walkStartedAtRef.current = null;
      } else {
        // Still walking towards target
        const currentProgress = elapsedSec / durationSec;
        const currentLat = startLat + dLat * currentProgress;
        const currentLng = startLng + dLng * currentProgress;
        setPosition([currentLat, currentLng]);
        setTargetPosition([targetLat, targetLng]);
        walkTargetRef.current = [targetLat, targetLng];
        walkStartRef.current = [startLat, startLng];
        walkStartedAtRef.current = startedAt;
        setIsWalking(true);
      }
    }

    // Restore travel state from DB if present
    if (data && data.travel_path && data.travel_started_at && data.travel_duration_seconds) {
      const path: [number, number][] = data.travel_path;
      const departedAt = new Date(data.travel_started_at);
      const durationSec: number = data.travel_duration_seconds;
      const elapsedSec = (Date.now() - departedAt.getTime()) / 1000;

      if (elapsedSec >= durationSec) {
        // Already arrived, jump to destination immediately
        const finalPos = path[path.length - 1];
        setPosition(finalPos);
        setIsTraveling(false);
        setTravelPath([]);
        setTravelDepartedAt(null);
        setTravelDurationSec(0);
        // Clear travel state on DB (will be done by next saveProfile)
      } else {
        // Journey in progress, restore travel state
        setTravelPath(path);
        setTravelDepartedAt(departedAt);
        setTravelDurationSec(durationSec);
        setIsTraveling(true);
      }
    }

    setLoading(false);
  };

  // Sync to database
  const saveProfile = useCallback(async (newState?: CharacterStats, forceLocation?: [number, number]) => {
    if (isDoubleTabbedRef.current) return;
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

    const { error } = await supabase.from('profiles').update({
      level: p.level, exp: p.exp, max_exp: p.maxExp,
      hp: p.hp, max_hp: p.maxHp, mp: p.mp, max_mp: p.maxMp, attack: p.attack, defense: p.defense,
      gold: p.gold, base_materials: p.baseMaterials,
      ling_qi: p.lingQi,
      tech_fragments: p.techFragments,
      incense: p.incense,
      salt_crystals: p.saltCrystals,
      premium_gems: p.premiumGems,
      buildings: p.buildings,
      equipment: p.equipment,
      equipped_weapon: p.equippedWeapon,
      equipped_armor: p.equippedArmor,
      equipped_helmet: p.equippedHelmet,
      equipped_boots: p.equippedBoots,
      equipped_accessory: p.equippedAccessory,
      items: p.items,
      skills: p.skills,
      partners: p.partners,
      gods: p.gods,
      active_god_id: p.activeGodId,
      session_id: mySessionId,
      current_location_lat: forceLocation ? forceLocation[0] : positionRef.current[0],
      current_location_lng: forceLocation ? forceLocation[1] : positionRef.current[1],
      ...travelSaveData,
      ...walkSaveData,
      updated_at: new Date().toISOString()
    }).eq('id', session.user.id);

    if (error) {
      console.error('Save Profile Error:', error);
    } else {
      console.log('Profile Saved Successfully');
    }
  }, [session, mySessionId, isTraveling]);

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
          // still process natural MP recovery
          if (p.mp < p.maxMp) {
            return { ...p, mp: Math.min(p.maxMp, p.mp + 0.5) }; // 每秒恢復 0.5 點 MP
          }
          return p;
        }
        const nextMp = Math.min(p.maxMp, p.mp + 0.5);
        return { ...p, gold: p.gold + dg, baseMaterials: p.baseMaterials + dm, mp: nextMp };
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const [isCombatAction, setIsCombatAction] = useState(false);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [autoExplore, setAutoExplore] = useState(false);

  const move = useCallback((d: 'n' | 's' | 'e' | 'w') => {
    const s = 0.00025;
    setPosition(p => {
      const next: [number, number] = d === 'n' ? [p[0] + s, p[1]] : d === 's' ? [p[0] - s, p[1]] : d === 'e' ? [p[0], p[1] + s] : [p[0], p[1] - s];
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
    if ('vibrate' in navigator) navigator.vibrate(10); // Subtle haptic feedback
  };

  const stopMove = () => {
    moveDirRef.current = null;
  };

  // Click-to-Move Walking Animation (Time-based for persistence)
  useEffect(() => {
    if (!targetPosition || isTraveling) {
      setIsWalking(false);
      return;
    }

    let frameId: number;
    // Speed is ~0.00008 lat/lng units per frame (assuming 60fps = ~0.0048 per sec limit)
    // Actually walking is 0.00008 hypot distance per frame ~ 0.0048 per second
    const speedPerSec = 0.0048;

    // Initialize refs if starting a new walk
    if (!walkStartRef.current || !walkStartedAtRef.current || !walkTargetRef.current || walkTargetRef.current[0] !== targetPosition[0] || walkTargetRef.current[1] !== targetPosition[1]) {
      walkStartRef.current = [...positionRef.current] as [number, number];
      walkTargetRef.current = [...targetPosition] as [number, number];
      walkStartedAtRef.current = new Date();
      saveProfileRef.current?.(); // Trigger save to register new walk start
    }

    const animate = () => {
      const startLat = walkStartRef.current![0];
      const startLng = walkStartRef.current![1];
      const targetLat = walkTargetRef.current![0];
      const targetLng = walkTargetRef.current![1];
      const startedAt = walkStartedAtRef.current!;

      const elapsedSec = (Date.now() - startedAt.getTime()) / 1000;
      const dLat = targetLat - startLat;
      const dLng = targetLng - startLng;
      const dist = Math.hypot(dLat, dLng);
      const durationSec = dist / speedPerSec;

      if (durationSec <= 0 || elapsedSec >= durationSec) {
        // Arrived
        setPosition([targetLat, targetLng]);
        setTargetPosition(null);
        setIsWalking(false);
        walkTargetRef.current = null;
        walkStartRef.current = null;
        walkStartedAtRef.current = null;
        saveProfileRef.current?.(undefined, [targetLat, targetLng]); // Save arrival with exact final coordinates
        return;
      }

      setIsWalking(true);
      const currentProgress = elapsedSec / durationSec;
      const currentLat = startLat + dLat * currentProgress;
      const currentLng = startLng + dLng * currentProgress;

      if (!isInTaiwan(currentLat, currentLng)) {
        // Stop walking if we hit the boundary mid-walk
        setTargetPosition(null);
        setIsWalking(false);
        walkTargetRef.current = null;
        walkStartRef.current = null;
        walkStartedAtRef.current = null;
        saveProfileRef.current?.(undefined, [currentLat, currentLng]);
        return;
      }

      setPosition([currentLat, currentLng]);

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [targetPosition, isTraveling]);

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

  const startHunt = useCallback((isElite = false) => {
    if (isTravelingRef.current) return; // (If in train, cannot hunt)
    const p = playerRef.current;
    if (!p) return;
    const lv = p.level;
    const pool = MONSTER_DATABASE.filter(m => lv >= m.minLv && lv <= m.maxLv + 5);
    const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : MONSTER_DATABASE[0];

    const isBoss = isElite && template.name.includes('黑龍'); // Using Black Dragon as Boss definition for now
    const statMultiplier = isElite ? 2.5 : 1;

    let hp, eAtk, eDef;

    if (isElite || isBoss) {
      // Dynamic Scaling System: Scale based on player's overall combat power
      const pHP = p.maxHp + totalEquipHp(p) + totalPartnerHp(p);
      const pATK = p.attack + totalEquipAtk(p) + totalPartnerAtk(p);
      const pDEF = p.defense + totalEquipDef(p) + totalPartnerDef(p);

      const diffMultiplier = isBoss ? 1.5 : 1.0;

      // HP: Set to require 5-8 hits from player's total ATK to kill
      const baseHp = Math.max(template.baseHp * statMultiplier, pATK * (5 + Math.random() * 3) * diffMultiplier);

      // ATK: Target 15-20% of player's total HP per hit (after DEF reduction is considered)
      // Elite Attack - Player Def = Target Damage => Elite Attack = Target Damage + Player Def
      const targetDmgPerHit = pHP * (0.15 + Math.random() * 0.05) * diffMultiplier;
      const baseAtk = Math.max(template.baseAtk * statMultiplier, pDEF + targetDmgPerHit);

      // DEF: Elite negates about 30% of player ATK
      const baseDef = Math.max(template.baseDef * statMultiplier, pATK * 0.3 * diffMultiplier);

      hp = Math.floor(baseHp);
      eAtk = Math.floor(baseAtk);
      eDef = Math.floor(baseDef);
    } else {
      hp = Math.floor((template.baseHp + lv * 8) * statMultiplier);
      eAtk = Math.floor((template.baseAtk + lv * 2) * statMultiplier);
      eDef = Math.floor((template.baseDef + Math.floor(lv * 0.8)) * statMultiplier);
    }

    const sk = SKILL_DATABASE[Math.floor(Math.random() * SKILL_DATABASE.length)];
    const lootCount = isElite ? 3 : (Math.random() > 0.6 ? 1 : 0);
    const loots: GameItem[] = [];

    // General loots (Exclude regional materials from general pool)
    const generalLootPool = ITEM_DATABASE.filter(i => !i.id.startsWith('mat_'));
    for (let i = 0; i < lootCount; i++) {
      const it = generalLootPool[Math.floor(Math.random() * generalLootPool.length)];
      const existing = loots.find(l => l.id === it.id);
      if (existing) existing.quantity++;
      else loots.push({ ...it, quantity: 1 } as GameItem);
    }

    // Equipment Drop Logic (Normal 1%, Elite 5%, Boss 10%)
    let eqDropChance = 0.01;
    if (isBoss) eqDropChance = 0.10;
    else if (isElite) eqDropChance = 0.05;

    let droppedEquip: Equipment | undefined = undefined;
    if (Math.random() < eqDropChance) {
      // Pick a random equipment appropriate for level
      const availableEqs = EQUIPMENT_DATABASE.filter(e => e.rarity <= (isBoss ? 5 : isElite ? 4 : 2));
      if (availableEqs.length > 0) {
        droppedEquip = { ...availableEqs[Math.floor(Math.random() * availableEqs.length)], id: `eq_${Date.now()}_${Math.random().toString(36).substring(2, 9)} ` };
      }
    }

    // Regional drops (Boss 100%, Elite 30%, Normal 10%)
    let regionalDropChance = 0.10;
    if (isBoss) regionalDropChance = 1.00;
    else if (isElite) regionalDropChance = 0.30;

    if (Math.random() < regionalDropChance) {
      // Combined Region Check: Coordinates (primary) + City Name (secondary)
      let region = getRegionByCoordinates(positionRef.current[0], positionRef.current[1]);
      if (region === 'unknown') {
        region = getRegionByCityName(areaName);
      }

      const matIds = getRegionalMaterials(region);
      if (matIds.length > 0) {
        const matId = matIds[Math.floor(Math.random() * matIds.length)];
        const regionalMat = ITEM_DATABASE.find(i => i.id === matId);
        if (regionalMat) {
          // check if already in loots
          const existing = loots.find(l => l.id === matId);
          if (existing) existing.quantity++;
          else loots.push({ ...regionalMat, quantity: 1 } as GameItem);
        }
      }
    }

    // Weather Effects on Stats (simplified)
    if (weatherRef.current === 'rainy') {
      eDef += 2; // monsters slightly tougher in rain
    } else if (weatherRef.current === 'foggy') {
      eAtk += 3; // monsters hit harder in fog
    }

    const enemy = {
      id: Math.random().toString(),
      name: (isBoss ? '【首領】' : isElite ? '【菁英】' : '') + template.name, avatar: template.avatar,
      level: lv + Math.floor(Math.random() * 3) - 1 + (isBoss ? 5 : isElite ? 2 : 0),
      hp, maxHp: hp,
      attack: eAtk,
      defense: eDef,
      expReward: Math.floor((18 + lv * 6) * statMultiplier),
      goldReward: Math.floor((8 + lv * 3) * statMultiplier),
      skillReward: (Math.random() < 0.25 || isElite) ? sk : undefined,
      lootTable: loots,
      equipmentDrop: droppedEquip,
    };
    setCurrentEnemy(enemy as Enemy & { equipmentDrop?: Equipment });
    setIsCombatAction(true);
  }, [player?.level]);

  // Auto Explore Logic
  useEffect(() => {
    if (!autoExplore || isCombatAction || activeTab !== 'explore' || isTraveling) return;

    // Movement & Encounter cycle
    const encounterMover = setInterval(() => {
      if (isDoubleTabbedRef.current) return;
      // Pick random direction
      const dirs: ('n' | 's' | 'e' | 'w')[] = ['n', 's', 'e', 'w'];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      move(d);

      // Foggy weather increases encounter rate from 30% to 50%
      const encounterThreshold = weatherRef.current === 'foggy' ? 0.5 : 0.7;
      if (Math.random() > encounterThreshold) {
        startHunt();
      }
    }, 2000); // Move every 2 seconds

    return () => clearInterval(encounterMover);
  }, [autoExplore, isCombatAction, activeTab, move, startHunt]);

  const handleCombatWin = useCallback(async (expReward: number, goldReward: number, learnedSkill?: Skill, lootList?: GameItem[], droppedEq?: Equipment, finalHp?: number, finalMp?: number) => {
    if (!player) return;

    // Basic Exp & Gold
    const newExp = player.exp + expReward;
    const newGold = player.gold + goldReward;

    // Handle Level Up
    let nextLevel = player.level;
    let nextExp = newExp;
    let nextMaxExp = player.maxExp;
    let nextMaxHp = player.maxHp;
    let nextMaxMp = player.maxMp;
    let nextAttack = player.attack;
    let nextDefense = player.defense;

    while (nextExp >= nextMaxExp) {
      nextExp -= nextMaxExp;
      nextLevel++;
      nextMaxExp = Math.floor(nextMaxExp * 1.5);
      nextMaxHp += 20;
      nextMaxMp += 10;
      nextAttack += 3;
      nextDefense += 2;
    }

    // Partner EXP Sharing (20% of reward)
    const partnerExpReward = Math.floor(expReward * 0.2);
    const updatedPartners = player.partners.map(p => {
      if (!p.isDeployed) return p;
      let pNextExp = p.exp + partnerExpReward;
      let pNextLevel = p.level;
      let pNextMaxExp = p.maxExp;
      let pNextPower = p.power;

      while (pNextExp >= pNextMaxExp) {
        pNextExp -= pNextMaxExp;
        pNextLevel++;
        pNextMaxExp = Math.floor(pNextMaxExp * 1.5);
        if (p.rarity === 5) pNextPower += 5;
        else if (p.rarity === 4) pNextPower += 3;
        else pNextPower += 2;
      }
      return { ...p, exp: pNextExp, level: pNextLevel, maxExp: pNextMaxExp, power: pNextPower };
    });

    // Merge Items
    const combinedItems = [...player.items];
    const itemsToAward = [...(lootList || [])];

    // Elite Monster: 15% chance to drop revive potion
    if (currentEnemy?.name.includes('【菁英】') && Math.random() < 0.15) {
      const potDef = ITEM_DATABASE.find(i => i.id === 'item_revive_pot');
      if (potDef) itemsToAward.push({ ...potDef, quantity: 1 });
    }

    itemsToAward.forEach(loot => {
      const existing = combinedItems.find(i => i.id === loot.id);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + (loot.quantity || 1);
      } else {
        combinedItems.push({ ...loot });
      }
    });

    // Handle learned skill / fragments
    const newSkills = [...player.skills];
    let skillRewardLog = null;
    if (learnedSkill) {
      const existingSkillIdx = newSkills.findIndex(s => s.id === learnedSkill.id);
      if (existingSkillIdx >= 0) {
        // Gain fragments instead
        newSkills[existingSkillIdx] = {
          ...newSkills[existingSkillIdx],
          fragments: (newSkills[existingSkillIdx].fragments || 0) + 1
        };
        skillRewardLog = { name: `${learnedSkill.name}碎片`, quantity: 1, icon: '🧩' };
      } else {
        // Learn new skill
        newSkills.push({ id: learnedSkill.id, level: 1, fragments: 0 });
        skillRewardLog = { name: `技能:${learnedSkill.name}`, quantity: 1, icon: '✨' };
      }
    }

    // Equipment Drops
    let newEquipment = [...player.equipment];
    if (droppedEq) {
      newEquipment.push(droppedEq);
    }

    const newLog: CombatLog = {
      id: Date.now().toString() + Math.random().toString(),
      type: 'win',
      enemyName: currentEnemy?.name || '未知魔物',
      exp: expReward,
      gold: goldReward,
      items: itemsToAward.map(i => ({ name: i.name, quantity: i.quantity || 1, icon: ITEM_DATABASE.find(itemDef => itemDef.id === i.id)?.icon ?? i.icon }))
        .concat(droppedEq ? [{ name: droppedEq.name, quantity: 1, icon: EQUIPMENT_DATABASE.find(eqDef => eqDef.id === droppedEq.id)?.icon ?? droppedEq.icon }] : [])
        .concat(skillRewardLog ? [skillRewardLog] : [])
    };
    setCombatLogs(prev => [...prev, newLog].slice(-6));

    const recoveredMp = Math.floor(nextMaxMp * 0.1); // Recover 10% MP on win
    const computedFinalMp = Math.min(nextMaxMp, (finalMp ?? player.mp) + recoveredMp);

    const nextState = {
      ...player,
      level: nextLevel,
      exp: nextExp,
      maxExp: nextMaxExp,
      hp: nextLevel > player.level ? nextMaxHp : (finalHp ?? player.hp), // Heal to full only on level up
      maxHp: nextMaxHp,
      mp: nextLevel > player.level ? nextMaxMp : computedFinalMp,
      maxMp: nextMaxMp,
      attack: nextAttack,
      defense: nextDefense,
      gold: newGold,
      skills: newSkills,
      items: combinedItems,
      equipment: newEquipment,
      partners: updatedPartners
    };

    setPlayer(nextState);
    saveProfile(nextState);

    setIsCombatAction(false);

    if (activePoiRef.current) {
      const techGain = Math.floor(Math.random() * 3) + 3; // 3-5 tech
      const lingQiGain = Math.floor(Math.random() * 3) + 2; // 2-4 lingqi

      const finalState = {
        ...nextState,
        techFragments: (nextState.techFragments ?? 0) + techGain,
        lingQi: (nextState.lingQi ?? 0) + lingQiGain
      };

      setPlayer(finalState);
      saveProfile(finalState);

      setLootMessage({
        title: '戰勝菁英！',
        items: [
          { name: '科技碎片', quantity: techGain, icon: '⚙️' },
          { name: '靈氣', quantity: lingQiGain, icon: '🌿' }
        ]
      });

      await supabase.rpc('resolve_poi_combat', { p_poi_id: activePoiRef.current, p_win: true });
      setPois(prev => prev.filter(p => p.id !== activePoiRef.current));
      setActivePoiCombat(null);
      fetchPois();
    }
  }, [player, currentEnemy, saveProfile, fetchPois]);

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

    if (activePoiRef.current) {
      const poiId = activePoiRef.current;
      await supabase.rpc('resolve_poi_combat', { p_poi_id: poiId, p_win: false });
      setEliteCooldowns(prev => ({ ...prev, [poiId]: Date.now() + 10000 }));
      setActivePoiCombat(null);
      fetchPois();
    }
  }, [player, saveProfile, fetchPois]);

  const equipItem = useCallback((eq: Equipment) => {
    if (!player) return;
    const slotKey = `equipped${eq.slot.charAt(0).toUpperCase() + eq.slot.slice(1)}` as keyof CharacterStats;
    const currentEquipped = player[slotKey] as Equipment | undefined;

    // Remove the new equipment from inventory
    let newInventory = player.equipment.filter(e => e.id !== eq.id);

    // If there was an old equipment, add it back to inventory
    if (currentEquipped) {
      newInventory.push(currentEquipped);
    }

    const nextState = {
      ...player,
      [slotKey]: eq,
      equipment: newInventory
    } as CharacterStats;

    setPlayer(nextState);
    saveProfile(nextState);
  }, [player, saveProfile]);

  const unequipItem = useCallback((slot: string) => {
    if (!player) return;
    const slotKey = `equipped${slot.charAt(0).toUpperCase() + slot.slice(1)}` as keyof CharacterStats;
    const currentEquipped = player[slotKey] as Equipment | undefined;

    if (!currentEquipped) return;

    const nextState = {
      ...player,
      [slotKey]: null,
      equipment: [...player.equipment, currentEquipped]
    } as CharacterStats;

    setPlayer(nextState);
    saveProfile(nextState);
  }, [player, saveProfile]);

  const useItem = useCallback((item: GameItem, silent = false) => {
    if (!player || (item.type !== 'potion' && item.type !== 'consumable')) return;

    // Update items list
    const newItems = player.items.map(i => {
      if (i.id === item.id) {
        const q = i.quantity ?? 1;
        return { ...i, quantity: q - 1 };
      }
      return i;
    }).filter(i => (i.quantity ?? 0) > 0);

    let nextState = { ...player, items: newItems };

    if (item.type === 'potion') {
      let recoverHp = 0;
      let recoverMp = 0;
      if (item.id === 'item_hp_pot' || item.id === 'it_01') recoverHp = 50;
      else if (item.id === 'item_hp_pot_m') recoverHp = 150;
      else if (item.id === 'item_mp_pot') recoverMp = 50;
      else if (item.id === 'item_revive_pot') recoverHp = 9999;

      const currentMaxHp = nextState.maxHp + totalEquipHp(nextState) + totalPartnerHp(nextState);
      nextState = {
        ...nextState,
        hp: Math.min(nextState.hp + recoverHp, currentMaxHp),
        mp: Math.min(nextState.mp + recoverMp, nextState.maxMp)
      };

      if (!silent) {
        const recoverItems = [];
        if (recoverHp > 0) recoverItems.push({ name: '恢復生命', quantity: Math.min(recoverHp, currentMaxHp - player.hp), icon: '💖' });
        if (recoverMp > 0) recoverItems.push({ name: '恢復魔力', quantity: Math.min(recoverMp, player.maxMp - player.mp), icon: '💧' });

        setLootMessage({
          title: '藥水使用確認',
          items: [
            { name: item.name, quantity: 1, icon: ITEM_DATABASE.find(itemDef => itemDef.id === item.id)?.icon ?? item.icon },
            ...recoverItems
          ]
        });
      }
    } else if (item.type === 'consumable') {
      if (item.id === 'item_str_seed') {
        nextState = { ...nextState, attack: nextState.attack + 2 };
        if (!silent) {
          setLootMessage({
            title: '永久能力提升！',
            items: [{ name: '攻擊力', quantity: 2, icon: '⚔️' }]
          });
        }
      } else if (item.id === 'item_def_seed') {
        nextState = { ...nextState, defense: nextState.defense + 2 };
        if (!silent) {
          setLootMessage({
            title: '永久能力提升！',
            items: [{ name: '防禦力', quantity: 2, icon: '🛡️' }]
          });
        }
      } else if (item.id === 'item_hp_seed') {
        nextState = { ...nextState, maxHp: nextState.maxHp + 10, hp: nextState.hp + 10 };
        if (!silent) {
          setLootMessage({
            title: '永久能力提升！',
            items: [{ name: '生命上限', quantity: 10, icon: '❤️' }]
          });
        }
      }
    }

    setPlayer(nextState);
    saveProfile(nextState);
  }, [player, saveProfile, totalEquipHp, totalPartnerHp]);

  const handleCraftAlchemy = useCallback((recipe: AlchemyRecipe) => {
    if (!player) return;

    // 1. Deduct Mats
    let currentItems = [...player.items];
    for (const req of recipe.materials) {
      currentItems = currentItems.map(i => i.id === req.id ? { ...i, quantity: (i.quantity ?? 1) - req.quantity } : i).filter(i => (i.quantity ?? 1) > 0);
    }

    // 2. Add Result
    const existing = currentItems.find(i => i.id === recipe.targetItemId);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + 1;
    } else {
      const itemDef = ITEM_DATABASE.find(i => i.id === recipe.targetItemId);
      if (itemDef) {
        currentItems.push({ ...itemDef, quantity: 1 });
      }
    }

    const nextState = {
      ...player,
      gold: player.gold - recipe.goldCost,
      items: currentItems
    };

    setPlayer(nextState);
    saveProfile(nextState);
  }, [player, saveProfile]);

  const handleCraftEquipment = useCallback((recipe: BlacksmithRecipe) => {
    if (!player) return;

    // Deduct materials
    const currentItems = [...player.items];
    recipe.materials.forEach(req => {
      const itemIdx = currentItems.findIndex(i => i.id === req.id);
      if (itemIdx >= 0) {
        const newQty = (currentItems[itemIdx].quantity ?? 1) - req.quantity;
        if (newQty <= 0) currentItems.splice(itemIdx, 1);
        else currentItems[itemIdx] = { ...currentItems[itemIdx], quantity: newQty };
      }
    });

    // Find target equipment definition
    const targetDef = EQUIPMENT_DATABASE.find(e => e.id === recipe.targetEquipmentId);
    if (!targetDef) return;

    // Add equipment with unique ID
    const newEquip: Equipment = {
      ...targetDef,
      id: `eq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };

    const nextState = {
      ...player,
      gold: player.gold - recipe.goldCost,
      items: currentItems,
      equipment: [...player.equipment, newEquip]
    };

    setPlayer(nextState);
    saveProfile(nextState);
  }, [player, saveProfile]);

  const handleSellItem = useCallback((item: GameItem) => {
    if (!player) return;

    // Define simple sell prices (30% of relative value)
    let sellPrice = 10;
    if (item.type === 'gem') sellPrice = 200;
    if (item.type === 'material') sellPrice = 15;
    if (item.type === 'potion') sellPrice = 50;
    if (item.id === 'item_revive_pot') sellPrice = 500;

    const newItems = player.items.map(i => i.id === item.id ? { ...i, quantity: (i.quantity ?? 1) - 1 } : i).filter(i => (i.quantity ?? 1) > 0);
    const nextState = { ...player, gold: player.gold + sellPrice, items: newItems };

    setPlayer(nextState);
    saveProfile(nextState);
  }, [player, saveProfile]);

  const handleUpgradeSkill = useCallback((skillId: string) => {
    if (!player) return;

    const skillIdx = player.skills.findIndex(s => s.id === skillId);
    if (skillIdx < 0) return;

    const pSkill = player.skills[skillIdx];
    const upgradeInfo = getSkillUpgradeInfo(pSkill.level);

    if (!upgradeInfo) {
      alert('已達最大等級！');
      return;
    }

    if (player.gold < upgradeInfo.gold || pSkill.fragments < upgradeInfo.fragments) {
      alert('資源不足！');
      return;
    }

    // Deduct costs
    let nextState = { ...player, gold: player.gold - upgradeInfo.gold };
    const newSkills = [...nextState.skills];
    newSkills[skillIdx] = { ...newSkills[skillIdx], fragments: newSkills[skillIdx].fragments - upgradeInfo.fragments };

    // Roll success
    const roll = Math.random() * 100;
    if (roll <= upgradeInfo.successRate) {
      // Success
      newSkills[skillIdx].level += 1;
      setLootMessage({
        title: '技能升級成功！',
        items: [{ name: SKILL_DATABASE.find(s => s.id === skillId)?.name || '未知技能', quantity: newSkills[skillIdx].level, icon: '⬆️' }]
      });
    } else {
      // Fail
      alert(`升級失敗... (機率: ${upgradeInfo.successRate}%)`);
    }

    nextState.skills = newSkills;
    setPlayer(nextState);
    saveProfile(nextState);
  }, [player, saveProfile]);

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
    const TRAVEL_SPEED_FACTOR = 0.0008;
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
  }, [player, inTown, position, session]);

  const activeGod = useMemo(() => {
    if (!player || !player.activeGodId) return null;
    return player.gods.find(g => g.id === player.activeGodId) || null;
  }, [player?.activeGodId, player?.gods]);

  // Memoize Icons to prevent shaking (re-creation of DIV icons kills performance)
  const playerIcon = useMemo(() => {
    const avatar = isTraveling ? '🚂' : isWalking ? '🏃‍♂️' : '🧙‍♂️';
    return createPlayerIcon(avatar, activeGod?.avatar);
  }, [isTraveling, isWalking, activeGod?.avatar]);

  const poiIconsMapping = useMemo(() => ({
    chest: createPoiIcon('chest'),
    merchant: createPoiIcon('merchant'),
    elite: createPoiIcon('elite'),
    altar: createPoiIcon('altar')
  }), []);


  const hasWeatherResistance = (type: WeatherType) => {
    if (!activeGod) return false;
    return activeGod.resistanceType === type || activeGod.resistanceType === 'all';
  };

  const effectiveAtk = player ? player.attack + totalEquipAtk(player) + totalPartnerAtk(player) : 0;
  const effectiveDef = player ? player.defense + totalEquipDef(player) + totalPartnerDef(player) : 0;
  const effectiveMaxHp = player ? player.maxHp + totalEquipHp(player) + totalPartnerHp(player) : 0;
  const effectiveHeal = player ? totalPartnerHeal(player) : 0;

  // Interaction Handler for POIs
  const handlePoiInteract = useCallback(async (poi: MapPOI) => {
    if (!session?.user?.id || isTraveling) return;

    if (poi.type === 'elite') {
      const cd = eliteCooldowns[poi.id];
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
      // 1% chance to drop a revive potion (calculated independently or separately, 
      // here we use a separate roll for the 1% chance to allow both or exclusive)
      // User said "10% herb 3, 1% revive", usually means separate chances.
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
    } else if (poi.type === 'altar') {
      // Heal both HP and MP to full, and gain Incense
      const currentMaxHp = player.maxHp + totalEquipHp(player) + totalPartnerHp(player);
      const incenseGain = Math.floor(Math.random() * 6) + 5; // 5-10 incense
      const nextState = {
        ...player,
        hp: currentMaxHp,
        mp: player.maxMp,
        incense: (player.incense ?? 0) + incenseGain
      };
      setLootMessage({
        title: '虔誠供奉',
        items: [{ name: '香火', quantity: incenseGain, icon: '🏮' }]
      });
      setPlayer(nextState);
      saveProfile(nextState);
    }

    if (poi.type === 'elite') {
      startHunt(true);
    }
  }, [startHunt, session, fetchPois, player, saveProfile]);

  const nearestTown = TOWN_DATABASE.find(t => getDistance(position[0], position[1], t.lat, t.lng) <= t.radius);
  const nearestPoi = pois.find(p => getDistance(position[0], position[1], p.lat, p.lng) <= 200);

  // Handle clicking on POIs or Towns (require 2 clicks to move)
  const handleMarkClick = useCallback((id: string, lat: number, lng: number) => {
    if (isTraveling || inTown || activePoiCombat) return;

    let label = '未知地點';
    const town = TOWN_DATABASE.find(t => t.id === id);
    if (town) {
      label = town.name;
    } else {
      const poi = pois.find(p => p.id === id);
      if (poi) label = POI_NAMES[poi.type] || '神秘地點';
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

  const poiLayers = useMemo(() => pois.map(p => {
    return (
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
    );
  }), [pois, poiIconsMapping, handleMarkClick]);

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

        {/* Right: Weather & Config */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 bg-game-accent/20 hover:bg-game-accent/40 text-game-accent px-3 py-1.5 rounded-full border border-game-accent/30 transition shadow-[0_0_10px_rgba(99,102,241,0.2)]"
            title="指南手冊"
          >
            <Book size={14} />
            <span className="text-xs font-bold hidden sm:inline">指南</span>
          </button>

          {/* 財庫按鈕 (新) */}
          <button
            onClick={() => setShowTreasury(true)}
            className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-500 px-3 py-1.5 rounded-full border border-amber-500/30 transition shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            title="查看所有財產"
          >
            <Coins size={14} />
            <span className="text-xs font-bold hidden sm:inline">財庫</span>
          </button>

          <button onClick={() => supabase.auth.signOut()} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white" title="登出">
            <SettingsIcon size={20} />
          </button>
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
                { id: 'incense', label: '香火', val: player.incense, icon: <Flame className="text-red-400" size={24} />, desc: '來自全台各地廟宇的信仰力量，可用於祭祀。', color: 'text-red-400' },
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

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="flex-1 relative overflow-hidden">

        {/* ─── EXPLORE ─── */}
        {activeTab === 'explore' && (
          <div className="w-full h-full relative">
            <MapContainer center={position} zoom={15} zoomControl={false} className="w-full h-full">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              {townLayers}
              {poiLayers}
              <Marker position={position} icon={playerIcon}>
                <Popup>你的位置</Popup>
              </Marker>
              <MapClickHandler />
              <MapUpdater center={position} isTraveling={isTraveling} />

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

            {/* Deployed Partners */}
            <div className="absolute top-4 left-4 z-[1000] flex gap-2 pointer-events-none flex-wrap max-w-[calc(100vw-100px)]">
              {player.partners.filter(p => p.isDeployed).map((p) => {
                const colors = RARITY_COLORS[p.rarity];
                return (
                  <div key={p.id} className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl border-2 pointer-events-auto bg-black/60 backdrop-blur-md shadow-lg ${colors ? colors.border + ' ' + colors.glow : 'border-gray-500'} ${isTraveling ? 'opacity-50 grayscale' : ''}`} title={p.name}>
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


            {/* Weather Overlay - Moved to Map */}
            <div className="absolute top-4 right-4 z-[1000]">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-lg tooltip-wrap cursor-help pointer-events-auto transition-all hover:bg-black/80">
                <span className="text-2xl drop-shadow-md">{WEATHER_TYPES[weather].icon}</span>
                <span className="text-sm font-bold text-white drop-shadow-md">{WEATHER_TYPES[weather].label}</span>
                <div className="tooltip-text tooltip-bottom">
                  <div className="font-bold text-white mb-1">{WEATHER_TYPES[weather].label}</div>
                  <div className="text-gray-400 text-[10px] whitespace-nowrap">{WEATHER_TYPES[weather].description}</div>
                </div>
              </div>
            </div>


            {/* Bottom Left Area - Logs & Area Card */}
            <div className="absolute bottom-8 left-6 z-[1000] flex flex-col gap-3 pointer-events-none items-start">

              {/* Combat Logs */}
              {combatLogs.length > 0 && logOpacity > 0 && (
                <div className="flex flex-col gap-1.5 transition-opacity duration-300 pointer-events-none max-w-[calc(100vw-3rem)] md:max-w-[400px]" style={{ opacity: logOpacity }}>
                  {combatLogs.map(log => (
                    <div key={log.id} className="text-[11px] md:text-[12px] font-bold px-3 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-sm flex flex-wrap items-center gap-x-2 gap-y-1 anim-fade-in-up pointer-events-auto w-fit max-w-full">
                      {log.type === 'win' ? (
                        <>
                          <span className="whitespace-nowrap">⚔️ 擊敗 {log.enemyName}</span>
                          <span className="text-gray-400">|</span>
                          <span className="text-sky-300 whitespace-nowrap">+{log.exp} EXP</span>
                          <span className="text-gray-400">|</span>
                          <span className="text-game-gold whitespace-nowrap">+{log.gold} 金幣</span>
                          {log.items && log.items.length > 0 && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span className="text-emerald-300">
                                {log.items.map(i => `${i.icon}${i.name}x${i.quantity}`).join(', ')}
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="whitespace-nowrap">💀 挑戰 {log.enemyName} 失敗</span>
                          <span className="text-gray-400">|</span>
                          <span className="text-red-400">{log.message}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Area Card */}
              <div className="max-w-[calc(100vw-3rem)] sm:w-72 glass-panel p-4 rounded-2xl anim-fade-in-up pointer-events-auto border-t-2 border-t-game-accent/50 shadow-2xl">
                <div className="flex items-center gap-1.5 mb-3">
                  <MapPin size={16} className="text-game-accent flex-shrink-0" />
                  <span className="font-bold text-sm text-game-accent tracking-wide flex-shrink-0">探索區域</span>
                  <span className="ml-auto text-[9px] bg-game-accent/10 text-game-accent px-1.5 py-0.5 rounded-full border border-game-accent/30 flex-shrink-0">Lv.{Math.max(1, player!.level - 2)}~{player!.level + 3}</span>
                  <button
                    onClick={() => setLogOpacity(o => o === 1 ? 0.7 : o === 0.7 ? 0.3 : o === 0.3 ? 0 : 1)}
                    className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-lg bg-white/5 border border-white/20 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                    title="日誌透明度"
                  >
                    {logOpacity === 1 ? '👁️ 100%' : logOpacity === 0.7 ? '🌫️ 70%' : logOpacity === 0.3 ? '👻 30%' : '🙈 隱蔽'}
                  </button>
                </div>
                <p className="text-base font-bold mb-1">{areaName}</p>
                <p className="text-xs text-gray-400 mb-4">這片區域潛伏著各種危險的生物...</p>
                <div className="flex flex-col gap-2">
                  {nearestTown && (
                    <button onClick={() => setInTown(nearestTown)} className="w-full h-10 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 px-3 text-sm">
                      <Home size={18} /> 進入 {nearestTown.name}
                    </button>
                  )}
                  <div className="flex gap-2">
                    {nearestPoi ? (
                      <button onClick={() => handlePoiInteract(nearestPoi)} disabled={isTraveling} className={`flex-1 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 ${isTraveling ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:from-emerald-400 hover:to-teal-400'} text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 px-3 text-sm`}>
                        <MapPin size={18} /> 互動 ({POI_NAMES[nearestPoi.type] || '未知'})
                      </button>
                    ) : (
                      <button onClick={() => startHunt(false)} disabled={autoExplore || isTraveling} className={`flex-1 h-10 ${autoExplore || isTraveling ? 'bg-gray-600/50 cursor-not-allowed text-gray-400' : 'bg-gradient-to-r from-game-accent to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-game-accent/20'} font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg px-3 text-sm`}>
                        <Sword size={18} /> {autoExplore ? '自動探索' : isTraveling ? '火車旅途中' : '自由狩獵'}
                      </button>
                    )}
                    <button
                      onClick={() => { if (!isTraveling) setAutoExplore(!autoExplore); }}
                      disabled={isTraveling}
                      className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${isTraveling ? 'bg-white/5 opacity-30 cursor-not-allowed' : autoExplore ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-lg shadow-green-500/20' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
                    >
                      <Zap size={18} className={autoExplore && !isTraveling ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
        {activeTab === 'partners' && <PartnersTab player={player!} onUpdatePlayer={setPlayer as any} saveProfile={saveProfile} isCombatAction={isCombatAction} />}

        {activeTab === 'home' && <HomeTab player={player!} onUpdatePlayer={setPlayer as any} saveProfile={saveProfile} />}

        {/* ─── RANKING (排行) ─── */}
        {activeTab === 'ranking' && <RankingTab player={player!} />}

        {/* ─── STATS (勇者) ─── */}
        {activeTab === 'stats' && (
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
        )}

        {/* ─── BAG (行囊) ─── */}
        {activeTab === 'bag' && (
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
                  {player.equipment.map(eq => {
                    const r = RARITY_COLORS[eq.rarity];
                    return (
                      <div key={eq.id} className="tooltip-wrap" onClick={() => equipItem(eq)}>
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
                  {player.items.map(item => (
                    <div key={item.id} className="tooltip-wrap" onClick={() => (item.type === 'potion' || item.type === 'consumable') && useItem(item)}>
                      <div className={`inv-slot ${(item.type === 'potion' || item.type === 'consumable') ? 'cursor-pointer hover:ring-2 hover:ring-game-accent/50' : 'opacity-80'}`}>
                        <span className="text-2xl">{ITEM_DATABASE.find(i => i.id === item.id)?.icon ?? item.icon}</span>
                        <span className="inv-qty">×{item.quantity}</span>
                      </div>
                      <div className="tooltip-text">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-gray-400 text-[11px]">{item.description}</div>
                        {(item.type === 'potion' || item.type === 'consumable') && <div className="mt-1 text-[10px] text-game-accent font-bold">點擊使用</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Combat Overlay */}
        {isCombatAction && currentEnemy && (
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
            onWin={(exp: number, gold: number, skill?: Skill, loot?: GameItem[], eq?: Equipment, finalHp?: number, finalMp?: number) => {
              handleCombatWin(exp, gold, skill, loot, eq, finalHp, finalMp);
            }}
            onLose={(finalHp?: number, finalMp?: number) => {
              handleCombatLose(finalHp, finalMp);
            }}
            onFlee={() => { setIsCombatAction(false); setAutoExplore(false); }}
            autoExplore={autoExplore}
            weather={weather}
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
        )}

        {/* Merchant Shop Overlay */}
        {isMerchantOpen && (
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
        )}

        {/* Town Overlay */}
        {inTown && (
          <TownScreen
            town={inTown}
            player={player!}
            onLeave={() => setInTown(null)}
            onCraftAlchemy={handleCraftAlchemy}
            onCraftEquipment={handleCraftEquipment}
            onTravel={handleTravel}
          />
        )}
      </div>

      {/* ═══════════ BOTTOM NAV ═══════════ */}
      <div className="glass-panel px-2 py-2 flex justify-around items-center z-[1100]">
        {[
          { key: 'explore', icon: <Compass size={22} />, label: '探索' },
          { key: 'partners', icon: <Users size={22} />, label: '夥伴' },
          { key: 'home', icon: <Home size={22} />, label: '家園' },
          { key: 'bag', icon: <Package size={22} />, label: '行囊' },
          { key: 'ranking', icon: <Trophy size={22} />, label: '排行' }
        ].map(tab => (
          <button key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
            }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${activeTab === tab.key ? 'text-game-accent bg-game-accent/10 scale-105' : 'text-gray-500 hover:text-gray-300'}`}>
            <div className={`transition-transform duration-300 ${activeTab === tab.key ? '-translate-y-1' : ''}`}>
              {tab.icon}
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
      {/* Onboarding Welcome Modal */}
      {showOnboarding && (
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
      )}
    </div>
  );
}

export default App;
