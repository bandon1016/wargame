import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Sword, Home, Users, Package, Settings as SettingsIcon, Book, Heart, Shield, Zap, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import type { CharacterStats, Enemy, Skill, GameItem, Equipment, WeatherType, Town, MapPOI } from './types/game';
import { MONSTER_DATABASE, SKILL_DATABASE, ITEM_DATABASE, RARITY_COLORS, WEATHER_TYPES, getRegionByCoordinates, getRegionalMaterials, TOWN_DATABASE } from './types/game';
import { CombatScreen } from './components/CombatScreen';
import { PartnersTab } from './components/PartnersTab';
import { HomeTab } from './components/HomeTab';
import { AuthScreen } from './components/AuthScreen';
import { TownScreen } from './components/TownScreen';
import { supabase } from './lib/supabase';

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
  merchant: '🐪',
  elite: '👹',
  altar: '⛩️'
};

const POI_NAMES = {
  chest: '遺落的寶物',
  merchant: '流浪商人',
  elite: '危險的菁英怪',
  altar: '神秘祭壇'
};

const createPoiIcon = (type: keyof typeof POI_ICONS) => L.divIcon({
  html: `<div style="font-size: 24px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.7)); transform: translate(-10%, -10%); opacity: 0.9;">${POI_ICONS[type]}</div>`,
  className: 'custom-poi-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
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

// Partner Stat Bonuses
const totalPartnerAtk = (p: CharacterStats) => p.partners.reduce((s, pt) => s + (pt.role === 'dps' ? pt.power : Math.floor(pt.power * 0.2)), 0);
const totalPartnerDef = (p: CharacterStats) => p.partners.reduce((s, pt) => s + (pt.role === 'tank' ? Math.floor(pt.power * 0.5) : Math.floor(pt.power * 0.1)), 0);
const totalPartnerHp = (p: CharacterStats) => p.partners.reduce((s, pt) => s + (pt.role === 'tank' || pt.role === 'healer' ? pt.power * 3 : pt.power), 0);

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
  const [areaName] = useState('信義區 — 台北市');

  const [inTown, setInTown] = useState<Town | null>(null);
  const [pois, setPois] = useState<MapPOI[]>([]);

  // Sync ref structure
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

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
        expiresAt: d.expires_at ? new Date(d.expires_at).getTime() : undefined
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

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      // Decode json fields if they were stored as JSON strings or raw objects
      setPlayer({
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
      // Load saved position
      if (data.current_location_lat != null && data.current_location_lng != null) {
        setPosition([data.current_location_lat, data.current_location_lng]);
      }
    } else if (error) {
      console.error('Fetch profile error:', error);
    }
    setLoading(false);
  };

  // Sync to database
  const saveProfile = async (newState?: CharacterStats) => {
    const p = newState || playerRef.current;
    if (!p || !session?.user?.id) return;

    await supabase.from('profiles').update({
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
      current_location_lat: positionRef.current[0],
      current_location_lng: positionRef.current[1],
      updated_at: new Date().toISOString()
    }).eq('id', session.user.id);
  };

  useEffect(() => {
    // Save every 10 seconds to avoid spamming the DB
    const saveInterval = setInterval(saveProfile, 10000);
    return () => clearInterval(saveInterval);
  }, [session]);

  // Resource tick
  useEffect(() => {
    const t = window.setInterval(() => {
      setPlayer(p => {
        if (!p) return null;
        let dg = 0, dm = 0;
        p.buildings.forEach(b => { if (b.type === 'gold_mine') dg += b.baseProduction / 60; else if (b.type === 'material_camp') dm += b.baseProduction / 60; });
        return { ...p, gold: p.gold + dg, baseMaterials: p.baseMaterials + dm };
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const [isCombatAction, setIsCombatAction] = useState(false);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [autoExplore, setAutoExplore] = useState(false);

  const move = useCallback((d: 'n' | 's' | 'e' | 'w') => {
    const s = 0.001;
    setPosition(p => d === 'n' ? [p[0] + s, p[1]] : d === 's' ? [p[0] - s, p[1]] : d === 'e' ? [p[0], p[1] + s] : [p[0], p[1] - s]);
  }, []);

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

    const enemy: Enemy = {
      id: Math.random().toString(),
      name: (isElite ? '【菁英】' : '') + template.name, avatar: template.avatar,
      level: lv + Math.floor(Math.random() * 3) - 1 + (isElite ? 2 : 0),
      hp, maxHp: hp,
      attack: eAtk,
      defense: eDef,
      expReward: Math.floor((18 + lv * 6) * statMultiplier),
      goldReward: Math.floor((8 + lv * 3) * statMultiplier),
      skillReward: (Math.random() < 0.25 || isElite) ? sk : undefined,
      lootTable: loots,
    };
    setCurrentEnemy(enemy);
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

  const handleCombatWin = useCallback((exp: number, gold: number, learnedSkill?: Skill, loot?: GameItem[]) => {
    setPlayer(prev => {
      if (!prev) return null;
      let { level: lv, exp: xp, maxExp: mx, hp, maxHp, attack: atk, defense: def, skills, items } = { ...prev, skills: [...prev.skills], items: [...prev.items] };
      xp += exp;
      if (xp >= mx) { lv++; xp -= mx; mx = Math.floor(mx * 1.4); maxHp += 15; hp = maxHp; atk += 4; def += 2; }
      if (learnedSkill && !skills.find(s => s.id === learnedSkill.id)) skills.push(learnedSkill);
      if (loot) loot.forEach(li => {
        const ex = items.find(i => i.id === li.id);
        if (ex) ex.quantity = (ex.quantity ?? 1) + (li.quantity ?? 1);
        else items.push({ ...li, quantity: li.quantity ?? 1 });
      });
      const nextState = { ...prev, level: lv, exp: xp, maxExp: mx, hp, maxHp, attack: atk, defense: def, gold: prev.gold + gold, skills, items };
      saveProfile(nextState);
      return nextState;
    });
    setIsCombatAction(false);
  }, [session]);

  const handleCombatLose = useCallback(() => {
    setPlayer(p => p ? ({ ...p, hp: Math.floor(p.maxHp * 0.15) }) : null);
    setIsCombatAction(false);
  }, []);

  const equipItem = useCallback((eq: Equipment) => {
    setPlayer(prev => {
      if (!prev) return null;
      const slotKey = `equipped${eq.slot.charAt(0).toUpperCase() + eq.slot.slice(1)}` as keyof CharacterStats;
      return { ...prev, [slotKey]: eq } as CharacterStats;
    });
  }, []);

  const useItem = useCallback((item: GameItem) => {
    if (item.type !== 'potion') return;

    setPlayer(prev => {
      if (!prev) return null;

      // Update items list
      const newItems = prev.items.map(i => {
        if (i.id === item.id) {
          return { ...i, quantity: (i.quantity ?? 1) - 1 };
        }
        return i;
      }).filter(i => (i.quantity ?? 1) > 0);

      // Perform healing logic
      let recoverAmount = 0;
      if (item.id === 'item_hp_pot' || item.id === 'it_01') {
        recoverAmount = 50;
      }

      const currentMaxHp = prev.maxHp + totalEquipHp(prev) + totalPartnerHp(prev);
      const newHp = Math.min(prev.hp + recoverAmount, currentMaxHp);

      const nextState = { ...prev, items: newItems, hp: newHp };
      saveProfile(nextState); // Immediately persist changes to avoid refresh loss
      return nextState;
    });
  }, [session]);

  const effectiveAtk = player ? player.attack + totalEquipAtk(player) + totalPartnerAtk(player) : 0;
  const effectiveDef = player ? player.defense + totalEquipDef(player) + totalPartnerDef(player) : 0;
  const effectiveMaxHp = player ? player.maxHp + totalEquipHp(player) + totalPartnerHp(player) : 0;

  // Interaction Handler for POIs
  const handlePoiInteract = useCallback(async (poi: MapPOI) => {
    if (!session?.user?.id) return;

    // DB Check
    const { data: success, error } = await supabase.rpc('interact_poi', { p_poi_id: poi.id });
    if (error || !success) {
      alert('這項事件已經消失，或是已經被其他人搶先觸發了！');
      fetchPois(); // Refresh immediately
      return;
    }

    // Success! Update local state
    if (poi.type === 'chest' || poi.type === 'elite') {
      setPois(prev => prev.filter(p => p.id !== poi.id)); // Remove the POI locally
    }

    setPlayer(prev => {
      if (!prev) return null;
      if (poi.type === 'chest') {
        const goldBounty = 100 + prev.level * 20;
        return { ...prev, gold: prev.gold + goldBounty };
      }
      if (poi.type === 'altar') {
        // Heal to full
        const currentMax = prev.maxHp + totalEquipHp(prev) + totalPartnerHp(prev);
        return { ...prev, hp: currentMax };
      }
      if (poi.type === 'merchant') {
        // Give free base materials for now
        return { ...prev, baseMaterials: prev.baseMaterials + 50 };
      }
      return prev;
    });

    // We can also trigger a save with the current ref slightly after
    setTimeout(() => saveProfile(), 500);

    if (poi.type === 'elite') {
      startHunt(true);
    }
  }, [startHunt, session, fetchPois]);

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
            <div className="text-sm font-bold truncate">勇者 <span className="text-gray-500 font-normal text-xs">Lv.{player.level}</span></div>
            {/* HP bar */}
            <div className="flex items-center gap-2 mt-0.5">
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
          <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
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
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              />
              {TOWN_DATABASE.map(t => (
                <Circle key={t.id} center={[t.lat, t.lng]} radius={t.radius} pathOptions={{ color: t.color, fillColor: t.color, fillOpacity: 0.1, weight: 2 }}>
                  <Popup>{t.name}</Popup>
                </Circle>
              ))}
              {pois.map(p => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={createPoiIcon(p.type)}>
                  <Popup>{POI_NAMES[p.type]}</Popup>
                </Marker>
              ))}
              <Marker position={position} icon={createPlayerIcon('🧙‍♂️')}>
                <Popup>你的位置</Popup>
              </Marker>
              <MapUpdater center={position} />
            </MapContainer>

            {/* D-Pad */}
            <div className="absolute bottom-8 right-6 z-[1000] flex flex-col items-center gap-1.5">
              <button onClick={() => move('n')} className="w-11 h-11 glass-panel rounded-xl flex items-center justify-center active:scale-90 transition-all hover:border-game-accent/50"><ChevronUp size={22} /></button>
              <div className="flex gap-1.5">
                <button onClick={() => move('w')} className="w-11 h-11 glass-panel rounded-xl flex items-center justify-center active:scale-90 transition-all hover:border-game-accent/50"><ChevronLeft size={22} /></button>
                <button onClick={() => move('s')} className="w-11 h-11 glass-panel rounded-xl flex items-center justify-center active:scale-90 transition-all hover:border-game-accent/50"><ChevronDown size={22} /></button>
                <button onClick={() => move('e')} className="w-11 h-11 glass-panel rounded-xl flex items-center justify-center active:scale-90 transition-all hover:border-game-accent/50"><ChevronRight size={22} /></button>
              </div>
            </div>

            {/* Area Card */}
            <div className="absolute bottom-8 left-6 z-[1000] w-72 glass-panel p-4 rounded-2xl anim-fade-in-up">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={16} className="text-game-accent" />
                <span className="font-bold text-sm text-game-accent tracking-wide">探索區域</span>
                <span className="ml-auto text-[10px] bg-game-accent/10 text-game-accent px-2 py-0.5 rounded-full border border-game-accent/30">Lv.{Math.max(1, player!.level - 2)}~{player!.level + 3}</span>
              </div>
              <p className="text-base font-bold mb-1">{areaName}</p>
              <p className="text-xs text-gray-400 mb-4">這片區域潛伏著各種危險的生物...</p>
              <div className="flex gap-2">
                {nearestTown ? (
                  <button onClick={() => setInTown(nearestTown)} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                    <Home size={18} /> 進入 {nearestTown.name}
                  </button>
                ) : nearestPoi ? (
                  <button onClick={() => handlePoiInteract(nearestPoi)} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                    <MapPin size={18} /> 互動 ({POI_NAMES[nearestPoi.type]})
                  </button>
                ) : (
                  <button onClick={() => startHunt(false)} disabled={autoExplore} className={`flex-1 ${autoExplore ? 'bg-gray-600' : 'bg-gradient-to-r from-game-accent to-indigo-500 hover:from-sky-400 hover:to-indigo-400'} text-white font-bold py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg ${autoExplore ? '' : 'shadow-game-accent/20'}`}>
                    <Sword size={18} /> {autoExplore ? '自動探索中...' : '開始狩獵'}
                  </button>
                )}
                <button
                  onClick={() => setAutoExplore(!autoExplore)}
                  className={`w-12 h-[44px] rounded-xl flex items-center justify-center transition-all ${autoExplore ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
                  title={autoExplore ? "停止自動探索" : "開啟自動探索"}
                >
                  <Zap size={18} className={autoExplore ? 'animate-pulse' : ''} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PARTNERS ─── */}
        {activeTab === 'partners' && <PartnersTab player={player!} onUpdatePlayer={setPlayer as any} />}

        {/* ─── HOME ─── */}
        {activeTab === 'home' && <HomeTab player={player!} onUpdatePlayer={setPlayer as any} />}

        {/* ─── BAG / CHARACTER ─── */}
        {activeTab === 'bag' && (
          <div className="p-5 h-full overflow-y-auto w-full space-y-5">

            {/* Character Card */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-game-accent/5 rounded-full blur-3xl" />
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-game-medium to-game-dark border-2 border-game-accent/50 flex items-center justify-center text-4xl anim-float anim-pulse-glow">
                    🧙‍♂️
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold flex items-center gap-2">勇者 <span className="text-sm text-game-accent font-normal bg-game-accent/10 px-2 py-0.5 rounded-full">Lv.{player.level}</span></h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <div className="stat-badge"><Sword size={14} className="text-red-400" /> <span className="text-red-400">{effectiveAtk}</span></div>
                    <div className="stat-badge"><Shield size={14} className="text-blue-400" /> <span className="text-blue-400">{effectiveDef}</span></div>
                    <div className="stat-badge"><Heart size={14} className="text-green-400" /> <span className="text-green-400">{effectiveMaxHp}</span></div>
                    <div className="stat-badge"><span className="text-game-gold">💰</span> <span className="text-game-gold">{Math.floor(player.gold)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Equipment Slots */}
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">⚔️ 裝備欄</h3>
              <div className="grid grid-cols-5 gap-3">
                {(['weapon', 'armor', 'helmet', 'boots', 'accessory'] as const).map(slot => {
                  const slotKey = `equipped${slot.charAt(0).toUpperCase() + slot.slice(1)}` as keyof CharacterStats;
                  const eq = player[slotKey] as Equipment | undefined;
                  const r = eq ? RARITY_COLORS[eq.rarity] : null;
                  return (
                    <div key={slot} className="tooltip-wrap">
                      <div className={`inv-slot ${r ? `border-2 ${r.border} ${r.bg} ${r.glow}` : ''}`}>
                        {eq ? <span className="text-3xl">{eq.icon}</span> : <span className="text-gray-600 text-xs">{slot === 'weapon' ? '武器' : slot === 'armor' ? '護甲' : slot === 'helmet' ? '頭盔' : slot === 'boots' ? '鞋子' : '飾品'}</span>}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {player.equipment.map(eq => {
                    const r = RARITY_COLORS[eq.rarity];
                    return (
                      <div key={eq.id} onClick={() => equipItem(eq)} className={`glass-panel p-3 rounded-xl border-2 ${r.border} ${r.glow} cursor-pointer hover:bg-white/5 transition-all active:scale-95 anim-fade-in-up`}>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{eq.icon}</span>
                          <div>
                            <div className={`font-bold text-sm ${r.text}`}>{eq.name}</div>
                            <div className="text-[10px] text-gray-400">{r.label} · {eq.slot === 'weapon' ? '武器' : eq.slot === 'armor' ? '護甲' : eq.slot === 'helmet' ? '頭盔' : eq.slot === 'boots' ? '鞋子' : '飾品'}</div>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2 text-[11px]">
                          {eq.attack > 0 && <span className="text-red-400">ATK +{eq.attack}</span>}
                          {eq.defense > 0 && <span className="text-blue-400">DEF +{eq.defense}</span>}
                          {eq.hp > 0 && <span className="text-green-400">HP +{eq.hp}</span>}
                        </div>
                        <div className="mt-2 text-center text-[10px] text-game-accent cursor-pointer">點擊裝備</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Items */}
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">🧪 道具</h3>
              {player.items.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">背包空空如也…去探索看看吧！</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {player.items.map(item => (
                    <div key={item.id} className="tooltip-wrap" onClick={() => useItem(item)}>
                      <div className={`inv-slot ${item.type === 'potion' ? 'cursor-pointer hover:ring-2 hover:ring-game-accent/50' : ''}`}>
                        <span className="text-2xl">{item.icon}</span>
                        <span className="inv-qty">×{item.quantity}</span>
                      </div>
                      <div className="tooltip-text">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-gray-400 text-[11px]">{item.description}</div>
                        {item.type === 'potion' && <div className="mt-1 text-[10px] text-game-accent font-bold">點擊使用</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Book size={16} /> 技能書</h3>
              {player.skills.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">尚未習得任何技能</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {player.skills.map((sk, i) => (
                    <div key={sk.id} className="flex items-center gap-3 bg-white/[0.03] p-3 rounded-xl border border-white/5 anim-slide-in" style={{ animationDelay: `${i * 60}ms` }}>
                      <span className="text-2xl flex-shrink-0">{sk.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{sk.name}</div>
                        <div className="text-[11px] text-gray-400 truncate">{sk.description}</div>
                      </div>
                      <div className="text-xs font-bold text-game-accent bg-game-accent/10 px-2 py-1 rounded-lg">{sk.power}</div>
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
              maxHp: effectiveMaxHp
            }}
            enemy={currentEnemy}
            onWin={(exp, gold, skill) => handleCombatWin(exp, gold, skill, currentEnemy.lootTable)}
            onLose={handleCombatLose}
            onFlee={() => { setIsCombatAction(false); setAutoExplore(false); }}
            autoExplore={autoExplore}
            weather={weather}
            onAutoHeal={() => {
              const pot = player.items.find(i => i.type === 'potion');
              if (pot) useItem(pot);
            }}
          />
        )}

        {/* Town Overlay */}
        {inTown && (
          <TownScreen town={inTown} onLeave={() => setInTown(null)} />
        )}
      </div>

      {/* ═══════════ BOTTOM NAV ═══════════ */}
      <div className="glass-panel px-2 py-2 flex justify-around items-center z-[1100]">
        {[
          { key: 'explore', icon: <Compass size={22} />, label: '探索' },
          { key: 'partners', icon: <Users size={22} />, label: '夥伴' },
          { key: 'home', icon: <Home size={22} />, label: '家園' },
          { key: 'bag', icon: <Package size={22} />, label: '行囊' },
          { key: 'settings', icon: <SettingsIcon size={22} />, label: '設置' },
        ].map(tab => (
          <button key={tab.key} onClick={() => tab.key === 'settings' ? supabase.auth.signOut() : setActiveTab(tab.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${activeTab === tab.key ? 'text-game-accent bg-game-accent/10 scale-105' : 'text-gray-500 hover:text-gray-300'}`}>
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.key === 'settings' ? '登出' : tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
