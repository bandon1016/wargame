import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Sword, Home, Users, Package, Settings as SettingsIcon, Book, Heart, Shield, Zap, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MapPin, Loader2, X, PlusCircle, Activity, Info, ShieldAlert, TrainFront } from 'lucide-react';
import type { CharacterStats, Equipment, GameItem, Skill, MapPOI, Town, WeatherType, Enemy, AlchemyRecipe, BlacksmithRecipe } from './types/game';
import { MONSTER_DATABASE, SKILL_DATABASE, ITEM_DATABASE, EQUIPMENT_DATABASE, RARITY_COLORS, WEATHER_TYPES, getRegionByCoordinates, getRegionalMaterials, TOWN_DATABASE, getPartnerAvatar, getRailwayPath } from './types/game';
import { CombatScreen } from './components/CombatScreen';
import { PartnersTab } from './components/PartnersTab';
import { HomeTab } from './components/HomeTab';
import { AuthScreen } from './components/AuthScreen';
import { TownScreen } from './components/TownScreen';
import { supabase } from './lib/supabase';

// Fix leaflet default icon paths in React
import L from 'leaflet';
import iconImg from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: iconImg, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

// Custom Player Icon (Avatar Emoji)
const createPlayerIcon = (emoji: string) => L.divIcon({
  html: `<div style="font-size: 32px; filter: drop-shadow(0 0 8px rgba(0,0,0,0.5)); transform: translate(-10%, -10%);">${emoji}</div>`,
  className: 'custom-player-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
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

function MapUpdater({ center, isTraveling }: { center: [number, number], isTraveling: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (isTraveling) {
      map.setZoom(11); // County level zoom
    } else {
      map.setZoom(15); // Street/City level zoom
    }
  }, [isTraveling, map]);

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: false });
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

const POI_NAMES: Record<string, string> = {
  chest: '遺落的物資',
  elite: '危險的魔物棲息地',
  altar: '神秘祭壇',
  merchant: '流浪商人'
};

const POI_DETAILS = {
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

interface CombatLog {
  id: string;
  type: 'win' | 'lose';
  enemyName: string;
  exp?: number;
  gold?: number;
  items?: { name: string; quantity: number; icon: string }[];
  message?: string;
}

const TAIWAN_BOUNDS = { minLat: 21.8, maxLat: 26.4, minLng: 119.0, maxLng: 122.5 };
const DEFAULT_POSITION: [number, number] = [25.0340, 121.5645]; // 台北101

const isInTaiwan = (lat: number, lng: number) =>
  lat >= TAIWAN_BOUNDS.minLat && lat <= TAIWAN_BOUNDS.maxLat &&
  lng >= TAIWAN_BOUNDS.minLng && lng <= TAIWAN_BOUNDS.maxLng;

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
  const [lootMessage, setLootMessage] = useState<{ title: string; items: { name: string; quantity: number; icon: string }[] } | null>(null);

  const [activePoiCombat, setActivePoiCombat] = useState<string | null>(null);
  const [isMerchantOpen, setIsMerchantOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [selectedLegendPoi, setSelectedLegendPoi] = useState<keyof typeof POI_DETAILS | null>(null);
  const [isDoubleTabbed, setIsDoubleTabbed] = useState(false);
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
  const saveProfileRef = React.useRef<((newState?: CharacterStats) => Promise<void>) | null>(null);

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
        if (data && data.address) {
          // Priority: city, town, village, state
          const city = data.address.city || data.address.town || data.address.village || data.address.state || '未知海域';
          setAreaName(city);
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
    if (!session?.user?.id) return;
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
    const poiGenerator = setInterval(fetchPois, 60000); // check 1 min
    return () => clearInterval(poiGenerator);
  }, [fetchPois]);



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
            hp: data.hp, maxHp: data.max_hp, attack: data.attack, defense: data.defense,
            gold: data.gold, baseMaterials: data.base_materials,
            buildings: data.buildings || [],
            equipment: data.equipment || [],
            equippedWeapon: data.equipped_weapon,
            equippedArmor: data.equipped_armor,
            equippedHelmet: data.equipped_helmet,
            equippedBoots: data.equipped_boots,
            equippedAccessory: data.equipped_accessory,
            items: data.items || [],
            skills: data.skills || [],
            partners: data.partners || [],
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
        hp: data.hp, maxHp: data.max_hp, attack: data.attack, defense: data.defense,
        gold: data.gold, baseMaterials: data.base_materials,
        buildings: data.buildings || [],
        equipment: data.equipment || [],
        equippedWeapon: data.equipped_weapon,
        equippedArmor: data.equipped_armor,
        equippedHelmet: data.equipped_helmet,
        equippedBoots: data.equipped_boots,
        equippedAccessory: data.equipped_accessory,
        items: data.items || [],
        skills: data.skills || [],
        partners: data.partners || [],
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
  const saveProfile = useCallback(async (newState?: CharacterStats) => {
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
      hp: p.hp, max_hp: p.maxHp, attack: p.attack, defense: p.defense,
      gold: p.gold, base_materials: p.baseMaterials,
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
      session_id: mySessionId,
      current_location_lat: positionRef.current[0],
      current_location_lng: positionRef.current[1],
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

        if (dg === 0 && dm === 0) return p; // 避免無意義的狀態變更觸發重繪與存檔計時器
        return { ...p, gold: p.gold + dg, baseMaterials: p.baseMaterials + dm };
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
          return d === 'n' ? [p[0] + s, p[1]] : d === 's' ? [p[0] - s, p[1]] : d === 'e' ? [p[0], p[1] + s] : [p[0], p[1] - s];
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
        saveProfileRef.current?.(); // Save arrival
        return;
      }

      setIsWalking(true);
      const currentProgress = elapsedSec / durationSec;
      const currentLat = startLat + dLat * currentProgress;
      const currentLng = startLng + dLng * currentProgress;
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
    if (!player) return;
    const lv = player.level;
    const pool = MONSTER_DATABASE.filter(m => lv >= m.minLv && lv <= m.maxLv + 5);
    const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : MONSTER_DATABASE[0];

    // Elite stats boost
    const statMultiplier = isElite ? 2.5 : 1;
    const hp = Math.floor((template.baseHp + lv * 8) * statMultiplier);
    const sk = SKILL_DATABASE[Math.floor(Math.random() * SKILL_DATABASE.length)];
    const lootCount = isElite ? 3 : (Math.random() > 0.6 ? 1 : 0);
    const loots: GameItem[] = [];
    if (lootCount > 0) {
      const it = ITEM_DATABASE[Math.floor(Math.random() * ITEM_DATABASE.length)];
      loots.push({ ...it, quantity: 1 });
    }

    // Equipment Drop Logic (Normal 1%, Elite 5%, Boss 10%)
    const isBoss = isElite && template.name.includes('黑龍'); // Using Black Dragon as Boss definition for now

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

    // Regional drops (50% chance to drop regional material)
    if (Math.random() > 0.5) {
      const region = getRegionByCoordinates(positionRef.current[0], positionRef.current[1]);
      const matIds = getRegionalMaterials(region);
      if (matIds.length > 0) {
        const matId = matIds[Math.floor(Math.random() * matIds.length)];
        const regionalMat = ITEM_DATABASE.find(i => i.id === matId);
        if (regionalMat) {
          // check if already in loots
          const existing = loots.find(l => l.id === matId);
          if (existing) existing.quantity++;
          else loots.push({ ...regionalMat, quantity: 1 });
        }
      }
    }

    // Weather Effects on Stats (simplified)
    let eAtk = Math.floor((template.baseAtk + lv * 2) * statMultiplier);
    let eDef = Math.floor((template.baseDef + Math.floor(lv * 0.8)) * statMultiplier);
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
    if (!autoExplore || isCombatAction || activeTab !== 'explore') return;

    // Movement & Encounter cycle
    const encounterMover = setInterval(() => {
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

  const handleCombatWin = useCallback(async (expReward: number, goldReward: number, learnedSkill?: Skill, lootList?: GameItem[], droppedEq?: Equipment, finalHp?: number) => {
    if (!player) return;

    // Basic Exp & Gold
    const newExp = player.exp + expReward;
    const newGold = player.gold + goldReward;

    // Handle Level Up
    let nextLevel = player.level;
    let nextExp = newExp;
    let nextMaxExp = player.maxExp;
    let nextMaxHp = player.maxHp;
    let nextAttack = player.attack;
    let nextDefense = player.defense;

    while (nextExp >= nextMaxExp) {
      nextExp -= nextMaxExp;
      nextLevel++;
      nextMaxExp = Math.floor(nextMaxExp * 1.5);
      nextMaxHp += 20;
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

    // Handle learned skill
    const newSkills = [...player.skills];
    if (learnedSkill && !newSkills.find(s => s.id === learnedSkill.id)) {
      newSkills.push(learnedSkill);
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
      items: itemsToAward.map(i => ({ name: i.name, quantity: i.quantity || 1, icon: ITEM_DATABASE.find(itemDef => itemDef.id === i.id)?.icon ?? i.icon })).concat(
        droppedEq ? [{ name: droppedEq.name, quantity: 1, icon: EQUIPMENT_DATABASE.find(eqDef => eqDef.id === droppedEq.id)?.icon ?? droppedEq.icon }] : []
      )
    };
    setCombatLogs(prev => [...prev, newLog].slice(-6));

    const nextState = {
      ...player,
      level: nextLevel,
      exp: nextExp,
      maxExp: nextMaxExp,
      hp: nextLevel > player.level ? nextMaxHp : (finalHp ?? player.hp), // Heal to full only on level up
      maxHp: nextMaxHp,
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
      await supabase.rpc('resolve_poi_combat', { p_poi_id: activePoiRef.current, p_win: true });
      setPois(prev => prev.filter(p => p.id !== activePoiRef.current));
      setActivePoiCombat(null);
      fetchPois();
    }
  }, [player, currentEnemy, saveProfile, fetchPois]);

  const handleCombatLose = useCallback(async (finalHp?: number) => {
    if (!player) return;
    const nextHp = finalHp ?? Math.floor(player.maxHp * 0.15);
    const nextState = { ...player, hp: nextHp };

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
      let recoverAmount = 0;
      if (item.id === 'item_hp_pot' || item.id === 'it_01') recoverAmount = 50;
      else if (item.id === 'item_hp_pot_m') recoverAmount = 150;
      else if (item.id === 'item_revive_pot') recoverAmount = 9999;

      const currentMaxHp = nextState.maxHp + totalEquipHp(nextState) + totalPartnerHp(nextState);
      const actualHeal = Math.min(recoverAmount, currentMaxHp - nextState.hp);
      nextState = { ...nextState, hp: Math.min(nextState.hp + recoverAmount, currentMaxHp) };

      if (!silent) {
        setLootMessage({
          title: '藥水使用確認',
          items: [{ name: item.name, quantity: 1, icon: ITEM_DATABASE.find(itemDef => itemDef.id === item.id)?.icon ?? item.icon }, { name: '恢復生命', quantity: actualHeal, icon: '💚' }]
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

  const effectiveAtk = player ? player.attack + totalEquipAtk(player) + totalPartnerAtk(player) : 0;
  const effectiveDef = player ? player.defense + totalEquipDef(player) + totalPartnerDef(player) : 0;
  const effectiveMaxHp = player ? player.maxHp + totalEquipHp(player) + totalPartnerHp(player) : 0;
  const effectiveHeal = player ? totalPartnerHeal(player) : 0;

  // Interaction Handler for POIs
  const handlePoiInteract = useCallback(async (poi: MapPOI) => {
    if (!session?.user?.id) return;

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
        const region = getRegionByCoordinates(position[0], position[1]);
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

      setLootMessage({
        title: '發現了物資箱！',
        items: itemsGot
      });

      const nextState = { ...player, gold: player.gold + goldBounty, items: newItems };
      setPlayer(nextState);
      saveProfile(nextState);
    } else if (poi.type === 'altar') {
      // Heal to full
      const currentMax = player.maxHp + totalEquipHp(player) + totalPartnerHp(player);
      const nextState = { ...player, hp: currentMax };
      setPlayer(nextState);
      saveProfile(nextState);
    }

    if (poi.type === 'elite') {
      startHunt(true);
    }
  }, [startHunt, session, fetchPois, player, saveProfile]);

  const nearestTown = TOWN_DATABASE.find(t => getDistance(position[0], position[1], t.lat, t.lng) <= t.radius);
  const nearestPoi = pois.find(p => getDistance(position[0], position[1], p.lat, p.lng) <= 200);

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
          setTargetPosition([e.latlng.lat, e.latlng.lng]);
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
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full border-2 border-game-gold bg-gradient-to-br from-game-medium to-game-dark flex items-center justify-center text-2xl anim-pulse-glow">
              🧙‍♂️
            </div>
            <div className="absolute -bottom-1 -right-1 bg-game-gold text-game-dark text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
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
              <div className="w-28 h-[6px] bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bar-hp transition-all duration-500 rounded-full" style={{ width: `${(player.hp / effectiveMaxHp) * 100}%` }} />
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums w-16 text-right">{player.hp}/{effectiveMaxHp}</span>
            </div>
            {/* EXP bar */}
            <div className="flex items-center gap-2 mt-0.5">
              <Zap size={10} className="text-sky-400 flex-shrink-0" />
              <div className="w-28 h-[4px] bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bar-exp transition-all duration-500 rounded-full" style={{ width: `${(player.exp / player.maxExp) * 100}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 tabular-nums w-16 text-right">{player.exp}/{player.maxExp}</span>
            </div>
          </div>
        </div>

        {/* Right: Weather & Config */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 tooltip-wrap cursor-help">
            <span className="text-xl">{WEATHER_TYPES[weather].icon}</span>
            <span className="text-xs font-bold text-gray-200">{WEATHER_TYPES[weather].label}</span>
            <div className="tooltip-text">
              <div className="font-bold text-white mb-1">{WEATHER_TYPES[weather].label}</div>
              <div className="text-gray-400 text-[10px]">{WEATHER_TYPES[weather].description}</div>
            </div>
          </div>
          <div className="stat-badge"><span className="text-amber-500">🧱</span> {Math.floor(player.baseMaterials)}</div>
          <div className="stat-badge"><span className="text-game-gold">💰</span> {Math.floor(player.gold)}</div>
          <button onClick={() => supabase.auth.signOut()} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white" title="登出">
            <SettingsIcon size={20} />
          </button>
        </div>
      </div>

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
              {TOWN_DATABASE.map(t => (
                <Circle key={t.id} center={[t.lat, t.lng]} radius={t.radius} pathOptions={{ color: t.color, fillColor: t.color, fillOpacity: 0.1, weight: 2 }}>
                  <Popup>{t.name}</Popup>
                </Circle>
              ))}
              {pois.map(p => {
                let statusLabel = '';
                // 菁英怪已被鎖定
                if (p.type === 'elite' && p.lockedBy) {
                  statusLabel = p.lockedBy === session?.user?.id ? ' (⚔️你的戰鬥)' : ' (⚔️戰鬥中)';
                }
                return (
                  <Marker key={p.id} position={[p.lat, p.lng]} icon={createPoiIcon(p.type)}>
                    <Popup>{POI_NAMES[p.type]}{statusLabel}</Popup>
                  </Marker>
                );
              })}
              <Marker position={position} icon={createPlayerIcon(isTraveling ? '🚂' : isWalking ? '🏃‍♂️' : '🧙‍♂️')}>
                <Popup>你的位置</Popup>
              </Marker>
              <MapClickHandler />
              <MapUpdater center={position} isTraveling={isTraveling} />

              {/* Destination Marker */}
              {targetPosition && (
                <Marker position={targetPosition} icon={L.divIcon({ html: '<div class="animate-bounce text-2xl">📍</div>', className: 'target-marker', iconSize: [30, 30], iconAnchor: [15, 30] })} />
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

            {/* D-Pad - Enhanced for Mobile */}
            <div className="absolute bottom-8 right-6 z-[1000] flex flex-col items-center gap-1.5 touch-none">
              <button
                onMouseDown={() => startMove('n')} onMouseUp={stopMove} onMouseLeave={stopMove}
                onTouchStart={(e) => { e.preventDefault(); startMove('n'); }} onTouchEnd={stopMove}
                className="w-12 h-12 bg-black/60 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 active:bg-game-accent/40 active:scale-95 transition-all shadow-xl"
              >
                <ChevronUp size={28} />
              </button>
              <div className="flex gap-1.5">
                <button
                  onMouseDown={() => startMove('w')} onMouseUp={stopMove} onMouseLeave={stopMove}
                  onTouchStart={(e) => { e.preventDefault(); startMove('w'); }} onTouchEnd={stopMove}
                  className="w-12 h-12 bg-black/60 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 active:bg-game-accent/40 active:scale-95 transition-all shadow-xl"
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  onMouseDown={() => startMove('s')} onMouseUp={stopMove} onMouseLeave={stopMove}
                  onTouchStart={(e) => { e.preventDefault(); startMove('s'); }} onTouchEnd={stopMove}
                  className="w-12 h-12 bg-black/60 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 active:bg-game-accent/40 active:scale-95 transition-all shadow-xl"
                >
                  <ChevronDown size={28} />
                </button>
                <button
                  onMouseDown={() => startMove('e')} onMouseUp={stopMove} onMouseLeave={stopMove}
                  onTouchStart={(e) => { e.preventDefault(); startMove('e'); }} onTouchEnd={stopMove}
                  className="w-12 h-12 bg-black/60 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 active:bg-game-accent/40 active:scale-95 transition-all shadow-xl"
                >
                  <ChevronRight size={28} />
                </button>
              </div>
            </div>

            {/* Map Legend (Cartoonish Style) */}
            <div className={`absolute top-4 right-4 z-[1000] transition-all duration-300 ease-out flex ${isLegendOpen ? 'w-64' : 'w-14'}`}>
              {!isLegendOpen && (
                <button
                  onClick={() => setIsLegendOpen(true)}
                  className="w-14 h-14 bg-white border-4 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-none transition-all"
                >
                  <Info size={24} className="text-black" strokeWidth={3} />
                </button>
              )}

              {isLegendOpen && (
                <div className="w-full bg-white border-4 border-black rounded-3xl p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col anim-fade-in text-black font-bold">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b-4 border-black">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-black" strokeWidth={3} />
                      <span className="font-black text-base uppercase tracking-tight">點位圖例</span>
                    </div>
                    <button onClick={() => setIsLegendOpen(false)} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
                      <ChevronRight size={22} className="text-black" strokeWidth={3} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(Object.entries(POI_DETAILS) as [keyof typeof POI_DETAILS, any][]).map(([key, info]) => (
                      <div key={key} className="flex flex-col">
                        <button
                          onClick={() => setSelectedLegendPoi(selectedLegendPoi === key ? null : key)}
                          className={`flex items-center gap-3 p-2 rounded-xl transition-all border-2 ${selectedLegendPoi === key ? 'bg-yellow-300 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-gray-100 border-transparent hover:bg-white hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
                        >
                          <div className="text-2xl w-10 h-10 flex items-center justify-center bg-white border-2 border-black rounded-lg">{info.icon}</div>
                          <span className="text-sm font-black text-black">{info.name}</span>
                        </button>

                        {selectedLegendPoi === key && (
                          <div className="mt-2 ml-2 px-3 py-2 border-l-4 border-black bg-blue-50 rounded-r-xl space-y-2 anim-scale-in shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
                            <div>
                              <div className="text-[10px] text-black font-black uppercase tracking-wider mb-0.5 bg-yellow-300 inline-block px-1 border border-black">出現頻率</div>
                              <div className="text-[11px] text-gray-800 leading-tight font-bold">{info.frequency}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-black font-black uppercase tracking-wider mb-0.5 bg-green-300 inline-block px-1 border border-black">互動效果</div>
                              <div className="text-[11px] text-gray-800 leading-tight font-bold">{info.effect}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="pt-2 mt-2 border-t-2 border-black/20">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={14} className="text-game-accent" strokeWidth={3} />
                        <span className="font-black text-[12px] uppercase">特產材料情報</span>
                      </div>
                      <div className="text-[11px] text-gray-800 font-bold space-y-1">
                        <div className="flex items-start gap-1.5"><span className="w-8 text-right shrink-0">北部:</span> 科技廢料 ⚙️, 魔法玻璃 🪷</div>
                        <div className="flex items-start gap-1.5"><span className="w-8 text-right shrink-0">中部:</span> 高山鐵礦 ⛰️, 神木枝枒 🍃</div>
                        <div className="flex items-start gap-1.5"><span className="w-8 text-right shrink-0">南部:</span> 炎漠紅砂 🏜️, 海淵珍珠 🦪</div>
                        <div className="flex items-start gap-1.5"><span className="w-8 text-right shrink-0">東部:</span> 花東水晶 💠, 玄武岩礦石 🌑</div>
                        <div className="text-[10px] text-game-accent mt-1.5 italic font-black">* 狩獵魔物時有極高機率掉落當地特產。</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                      <button onClick={() => handlePoiInteract(nearestPoi)} className="flex-1 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 px-3 text-sm">
                        <MapPin size={18} /> 互動 ({POI_NAMES[nearestPoi.type] || '未知'})
                      </button>
                    ) : (
                      <button onClick={() => startHunt(false)} disabled={autoExplore} className={`flex-1 h-10 ${autoExplore ? 'bg-gray-600' : 'bg-gradient-to-r from-game-accent to-indigo-500 hover:from-sky-400 hover:to-indigo-400'} text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg px-3 text-sm ${autoExplore ? '' : 'shadow-game-accent/20'}`}>
                        <Sword size={18} /> {autoExplore ? '自動探索' : '自由狩獵'}
                      </button>
                    )}
                    <button
                      onClick={() => setAutoExplore(!autoExplore)}
                      className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${autoExplore ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-lg shadow-green-500/20' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
                    >
                      <Zap size={18} className={autoExplore ? 'animate-pulse' : ''} />
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

        {/* ─── HOME ─── */}
        {activeTab === 'home' && <HomeTab player={player!} onUpdatePlayer={setPlayer as any} saveProfile={saveProfile} />}

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
                <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
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
                  {player.skills.map(sk => (
                    <div key={sk.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-colors">
                      <div className="text-3xl filter drop-shadow-md">✨</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-white">{sk.name}</div>
                        <div className="text-[11px] text-gray-400 truncate mt-1">{sk.description}</div>
                      </div>
                      <div className="text-[10px] font-black tracking-tighter text-game-accent bg-game-accent/10 px-2.5 py-1.5 rounded-lg border border-game-accent/20">
                        威力 {sk.power}
                      </div>
                    </div>
                  ))}
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
              // Rainy slightly lowers player defense
              defense: weather === 'rainy' ? Math.max(0, effectiveDef - 2) : effectiveDef,
              maxHp: effectiveMaxHp,
              heal: effectiveHeal
            }}
            enemy={currentEnemy}
            onWin={(exp: number, gold: number, skill?: Skill, loot?: GameItem[], eq?: Equipment, finalHp?: number) => {
              handleCombatWin(exp, gold, skill, loot, eq, finalHp);
            }}
            onLose={(finalHp?: number) => {
              handleCombatLose(finalHp);
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
          { key: 'stats', icon: <Activity size={22} />, label: '勇者' },
        ].map(tab => (
          <button key={tab.key}
            disabled={isCombatAction && tab.key !== activeTab}
            onClick={() => {
              if (isCombatAction) return;
              setActiveTab(tab.key);
            }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${activeTab === tab.key ? 'text-game-accent bg-game-accent/10 scale-105' : 'text-gray-500 hover:text-gray-300'} ${isCombatAction && tab.key !== activeTab ? 'opacity-20 cursor-not-allowed' : ''}`}>
            {tab.icon}
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
