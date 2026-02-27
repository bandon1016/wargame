import React, { useState } from 'react';
import { BookOpen, Map, Sword, TrendingUp, Hammer, Users, X, ChevronDown, Info, MapPin, Coins, Flame, Sparkles, Cpu, Waves, Diamond, Trophy } from 'lucide-react';
import { POI_DETAILS } from '../types/game';

interface GuideModalProps {
    onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
    const [activeSection, setActiveSection] = useState<string | null>('explore');

    const sections = [
        {
            id: 'explore',
            title: '地圖探索與移動',
            icon: <Map className="w-5 h-5 text-blue-400" />,
            emoji: '🗺️',
            content: (
                <ul className="space-y-3 text-sm text-gray-300 leading-relaxed">
                    <li><strong className="text-white">現實座標連動：</strong>遊戲舞台建構於真實的台灣地圖之上。只要輕觸螢幕，您的分身「勇者」便會背上行囊，踏上未知的冒險旅途。</li>
                    <li><strong className="text-white">真實時間體驗：</strong>所有的移動距離皆依據真實地理座標進行演算，長途跋涉將需要付出相應的現實時間，為旅程增添真實感。</li>
                    <li><strong className="text-white">便捷交通：</strong>可到大城鎮的車站購買車票，乘坐火車快速抵達目的地。</li>
                    <li><strong className="text-white">氣候變化：</strong>晴天、雨天、濃霧、暴雷，遊戲將不定時變換天氣類型，提升探索與戰鬥變化樂趣。</li>
                </ul>
            )
        },
        {
            id: 'combat',
            title: '遭遇戰與野外尋寶',
            icon: <Sword className="w-5 h-5 text-red-400" />,
            emoji: '⚔️',
            content: (
                <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                    <ul className="space-y-2">
                        <li><strong className="text-white">回合制戰鬥：</strong>在荒野中遭遇魔物時即觸發戰鬥回合。您可視戰況靈活選擇發動普攻、施放華麗魔法，或是飲用藥劑扭轉戰局。</li>
                        <li><strong className="text-white">自動戰鬥系統：</strong>支援自動移動與遇怪戰鬥，解放雙手。</li>
                    </ul>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                        <strong className="text-white block mb-2 border-b border-white/10 pb-1">野外奇遇 (POI)</strong>
                        <div className="flex gap-2"><span className="text-lg">📦</span> <div><strong className="text-game-gold">遺失的物資：</strong>開啟偶遇的物資箱，除了獲取金幣，有機率獲得道具或極稀有的<span className="text-indigo-400 font-bold">靈石</span>。</div></div>
                        <div className="flex gap-2"><span className="text-lg">⛩️</span> <div><strong className="text-game-accent">神秘祭壇：</strong>除恢復狀態，更能獲得<span className="text-red-400 font-bold">香火</span>，是與夥伴簽訂契約的關鍵。</div></div>
                        <div className="flex gap-2"><span className="text-lg">👹</span> <div><strong className="text-game-danger">菁英棲息地：</strong>戰勝菁英將獲得豐厚經驗，並必定掉落<span className="text-sky-400 font-bold">科技碎片</span>與<span className="text-emerald-400 font-bold">靈氣</span>。</div></div>
                        <div className="flex gap-2"><span className="text-lg">👳‍♂️</span> <div><strong className="text-emerald-400">流浪商人：</strong>行蹤飄忽的神秘行商。您可在此交易物資，或兌換稀有的科技零件。</div></div>
                    </div>
                </div>
            )
        },
        {
            id: 'growth',
            title: '角色養成與不傳之秘',
            icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
            emoji: '🌱',
            content: (
                <ul className="space-y-3 text-sm text-gray-300 leading-relaxed">
                    <li><strong className="text-white">基礎屬性成長：</strong>藉由戰鬥獲勝累積經驗、突破等級，全面昇華生命、魔力及攻防能力。</li>
                    <li><strong className="text-white">裝備掉落與屬性：</strong>魔物身上會掉落各式武器、防具與飾品，還有機會取得<span className="text-amber-400">珍稀製作材料</span>。</li>
                    <li><strong className="text-white">技能學習：</strong>戰勝部分強大魔物時，有機會將對方的得意招式化為己用。重複獲取相同技能會轉化為「技能碎片」，可用於技能強化。</li>
                    <li><strong className="text-white">永久潛能開發：</strong>服用傳說中的「能力種子」（如力量種子、生命之果），可以持續的提升角色的基礎潛能。</li>
                </ul>
            )
        },
        {
            id: 'town',
            title: '特色城鎮與大師工坊',
            icon: <Hammer className="w-5 h-5 text-amber-400" />,
            emoji: '🏰',
            content: (
                <ul className="space-y-3 text-sm text-gray-300 leading-relaxed">
                    <li><strong className="text-white">全台名城聚落：</strong>台北、台中、高雄、花東等繁華都會散落於地圖各處，是冒險者歇息與補給的最佳避風港。</li>
                    <li><strong className="text-white">地區專屬特產：</strong>台灣各地區皆孕育出獨一無二的地理特產。唯有踏遍名山勝水、集齊各地特產，方能鑄造出頂級名器。</li>
                    <li><strong className="text-white text-orange-400">大師鍛造 (鐵匠鋪)：</strong>利用野外發掘的粗礦石與各地特選材料，委託分佈於各城鎮的匠人，即可為您量身打造出具備地方風情的強力神兵與絕世防具。</li>
                    <li><strong className="text-white text-purple-400">鍊金奇蹟 (鍊金坊)：</strong>將沿途採摘的珍稀藥草與魔力寶石投入鍊金釜中，便可熬製出自補生命與魔力的救命靈藥，更有機會淬鍊出能突破極限的能力種子與復活聖水。</li>
                </ul>
            )
        },
        {
            id: 'territory',
            title: '領地經營與夥伴支援',
            icon: <Users className="w-5 h-5 text-purple-400" />,
            emoji: '👨‍👩‍👧‍👦',
            content: (
                <ul className="space-y-3 text-sm text-gray-300 leading-relaxed">
                    <li><strong className="text-white">自動化領地建設：</strong>擁有專屬的發展領地，可自由興建並升級「資源工坊」與「淘金礦場」。即使主將出外征戰，領地依然能日夜不休地產出建材與財富。</li>
                    <li><strong className="text-white">招募菁英夥伴：</strong>透過資源招致各路雄才加入您的麾下。</li>
                    <li><strong className="text-white">指派打工：</strong>拔擢閒置夥伴前往工坊或礦場任職。憑藉各自的職業專長（例如擅長防禦的騎士極度適任礦場戍衛），將大幅催化領地的生產效率。</li>
                    <li><strong className="text-white">溫暖助戰：</strong>將精銳夥伴編入戰鬥小隊，他們不僅會隨之吸取經驗、共同成長，更能在身側為主角提供巨額的戰力加成，甚至於激戰中定時施放「治癒光輝」逆轉乾坤。</li>
                </ul>
            )
        },
        {
            id: 'currency',
            title: '財庫與在地資源',
            icon: <Coins className="w-5 h-5 text-amber-400" />,
            emoji: '💰',
            content: (
                <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                    <p>在島嶼各處冒險，您將收集到具備在地特色的稀有資源，這些資源是強化戰力與家園的核心：</p>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { name: '金幣 / TWD', icon: '💰', desc: '商業重鎮的基礎貨幣。', color: 'text-amber-400' },
                            { name: '香火 (Incense)', icon: <Flame size={14} className="text-red-400" />, desc: '祭壇產出，用於夥伴召喚與契約。', color: 'text-red-400' },
                            { name: '仙草靈氣 (LingQi)', icon: <Sparkles size={14} className="text-emerald-400" />, desc: '菁英掉落，提昇秘術技能級別。', color: 'text-emerald-400' },
                            { name: '科技碎片 (Tech)', icon: <Cpu size={14} className="text-sky-400" />, desc: '尖端產業精華，用於神兵打造。', color: 'text-sky-400' },
                            { name: '藍寶靈石 (Gems)', icon: <Diamond size={14} className="text-indigo-400" />, desc: '極其稀有，可瞬間加速設施建設。', color: 'text-indigo-400' },
                            { name: '海鹽結晶 (Salt)', icon: <Waves size={14} className="text-blue-300" />, desc: '沿海物資，用於未來進階建設。', color: 'text-blue-300' },
                        ].map((res, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5">
                                <div className="w-8 h-8 flex items-center justify-center bg-black/40 rounded-md border border-white/10">{res.icon}</div>
                                <div>
                                    <div className={`font-bold text-xs ${res.color}`}>{res.name}</div>
                                    <div className="text-[10px] text-gray-500">{res.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: 'legend',
            title: '地圖標記與圖例',
            icon: <Info className="w-5 h-5 text-sky-400" />,
            emoji: 'ℹ️',
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-gray-300">地圖上的標記代表了各種奇遇與挑戰，詳細情報如下：</p>
                    <div className="space-y-3">
                        {(Object.entries(POI_DETAILS) as [keyof typeof POI_DETAILS, any][]).map(([key, info]) => (
                            <div key={key} className="flex gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                                <div className="text-2xl w-10 h-10 flex items-center justify-center shrink-0 bg-white/5 rounded-lg border border-white/10">{info.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-white text-sm mb-1">{info.name}</div>
                                    <div className="text-[11px] text-gray-400 mb-0.5"><strong className="text-gray-300">出現頻率：</strong>{info.frequency}</div>
                                    <div className="text-[11px] text-gray-400"><strong className="text-gray-300">互動效果：</strong>{info.effect}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 mt-2 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                            <MapPin size={16} className="text-game-accent" />
                            <span className="font-bold text-[13px] uppercase text-white tracking-wider">特產材料情報</span>
                        </div>
                        <div className="text-[12px] text-gray-400 space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/5">
                            <div className="flex items-start gap-2"><span className="w-10 text-right shrink-0 text-gray-300">北部:</span> <span className="text-white">科技廢料</span> ⚙️, <span className="text-white">魔法玻璃</span> 🪷</div>
                            <div className="flex items-start gap-2"><span className="w-10 text-right shrink-0 text-gray-300">中部:</span> <span className="text-white">高山鐵礦</span> ⛰️, <span className="text-white">神木枝枒</span> 🍃</div>
                            <div className="flex items-start gap-2"><span className="w-10 text-right shrink-0 text-gray-300">南部:</span> <span className="text-white">炎漠紅砂</span> 🏜️, <span className="text-white">海淵珍珠</span> 🦪</div>
                            <div className="flex items-start gap-2"><span className="w-10 text-right shrink-0 text-gray-300">東部:</span> <span className="text-white">花東水晶</span> 💠, <span className="text-white">玄武岩礦石</span> 🌑</div>
                            <div className="text-[11px] text-game-accent mt-2 pt-2 border-t border-white/5 font-bold">* 狩獵魔物時有隨機機率掉落當地特產，或透過流浪商人獲取。</div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'ranking',
            title: '全服巔峰榜',
            icon: <Trophy className="w-5 h-5 text-game-gold" />,
            emoji: '🏆',
            content: (
                <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                    <p>追求卓越，名留青史。巔峰榜記錄了島嶼上最強大且最富有的勇者們。</p>
                    <div className="space-y-3 bg-black/30 p-4 rounded-xl border border-white/5">
                        <div className="flex gap-3">
                            <TrendingUp size={18} className="text-game-accent shrink-0 mt-1" />
                            <div>
                                <strong className="text-white block mb-1 font-bold">三大巔峰榜單</strong>
                                <ul className="list-disc list-inside space-y-1 text-gray-400 text-xs">
                                    <li><span className="text-white">等級榜：</span>累計修行的見證，展示等級最高的冒險者。</li>
                                    <li><span className="text-white">戰力榜：</span>實力的綜合體現，反映勇者的戰鬥能力。</li>
                                    <li><span className="text-white">財富榜：</span>冒險與商業的收穫，展示資產最雄厚的豪傑。</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-3 border-t border-white/5">
                            <Info size={18} className="text-blue-400 shrink-0 mt-1" />
                            <div>
                                <strong className="text-white block mb-1 font-bold">結算與戰力機制</strong>
                                <div className="text-xs text-gray-400 space-y-2">
                                    <p>榜單於<span className="text-game-gold font-bold"> 每日凌晨 00:00 </span>進行系統快照結算並公告。</p>
                                    <p>
                                        冒險者的<span className="text-white">攻擊力、防禦力、生命上限與當前等級</span>皆會轉化為綜合戰力。均衡發展各項能力，更能穩健提升在全服巔峰榜中的席次。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-game-accent/5 p-3 rounded-lg border border-game-accent/20 text-[10px] font-bold text-game-accent text-center italic">
                        "只有實力與智慧並備者，方能登上巔峰之座。"
                    </div>
                </div>
            )
        },
    ];

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 anim-fade-in">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden anim-scale-in">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-game-medium/50 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-game-accent/20 flex items-center justify-center text-game-accent">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-wide font-sans">勇者冒險指南</h2>
                            <p className="text-xs text-game-accent font-bold tracking-wider mt-0.5">WARGAME SURVIVAL MANUAL</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 hover:text-game-danger transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body - Accordion */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {sections.map((sec) => {
                        const isActive = activeSection === sec.id;
                        return (
                            <div
                                key={sec.id}
                                className={`rounded-xl border transition-all duration-300 overflow-hidden ${isActive
                                    ? 'bg-black/40 border-game-accent/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                                    : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-black/30'
                                    }`}
                            >
                                <button
                                    onClick={() => setActiveSection(isActive ? null : sec.id)}
                                    className="w-full flex items-center justify-between p-4 focus:outline-none"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-white/10' : 'bg-transparent'}`}>
                                            {sec.icon}
                                        </div>
                                        <span className="font-bold text-gray-100 flex items-center gap-2">
                                            <span className="text-xl">{sec.emoji}</span>
                                            {sec.title}
                                        </span>
                                    </div>
                                    <div className={`text-gray-400 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`}>
                                        <ChevronDown size={20} />
                                    </div>
                                </button>

                                <div
                                    className={`transition-all duration-300 ease-in-out ${isActive ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                                        }`}
                                >
                                    <div className="p-4 pt-0 border-t border-white/5 mt-2">
                                        {sec.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/40 flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-game-accent hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] active:scale-95"
                    >
                        我知道了，開始冒險！
                    </button>
                </div>
            </div>
        </div>
    );
};
