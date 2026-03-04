import React from 'react';
import type { CharacterStats, PremiumShopItem } from '../types/game';
import { PREMIUM_SHOP_ITEMS } from '../types/game';
import { supabase } from '../lib/supabase';
import { X, Crown, AlertTriangle } from 'lucide-react';

interface PremiumShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    player: CharacterStats;
    refreshProfile: () => void;
}

export const PremiumShopModal: React.FC<PremiumShopModalProps> = ({
    isOpen,
    onClose,
    player,
    refreshProfile
}) => {
    const [buyingId, setBuyingId] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState<{ text: string, type: 'error' | 'success' } | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            setMessage(null);
            setBuyingId(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handlePurchase = async (item: PremiumShopItem) => {
        if (player.premiumGems < item.price) {
            setMessage({ text: '台灣藍寶靈石餘額不足！', type: 'error' });
            return;
        }

        const confirmText = `確定要花費 ${item.price} 顆 台灣藍寶靈石 購買並啟用【${item.name}】嗎？\n(注意：立刻生效，持續 24 小時)`;
        if (!window.confirm(confirmText)) return;

        setBuyingId(item.id);
        setMessage(null);
        try {
            const { error } = await supabase.rpc('secure_purchase_premium_item', {
                p_item_id: item.id,
                p_price: item.price,
                p_buff_key: item.buffKey,
                p_duration_ms: item.durationMs
            });

            if (error) throw error;

            setMessage({ text: `成功購買並啟用 ${item.name}！`, type: 'success' });
            refreshProfile(); // Trigger immediate update to see the new active_buffs
        } catch (err: any) {
            console.error('Purchase error:', err);
            setMessage({ text: err.message || '購買失敗，請稍後再試', type: 'error' });
        } finally {
            setBuyingId(null);
        }
    };

    const getRemainingTime = (expiryMs: number | undefined) => {
        if (!expiryMs) return null;
        const now = Date.now();
        if (now >= expiryMs) return null;
        const hours = Math.floor((expiryMs - now) / 3600000);
        const mins = Math.floor(((expiryMs - now) % 3600000) / 60000);
        return `${hours}小時${mins}分`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-6 pb-24 sm:pb-6">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-gradient-to-b from-indigo-950 to-slate-900 rounded-2xl border border-indigo-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-indigo-500/20 bg-slate-900/50 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <Crown className="text-indigo-400" size={24} />
                        <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 text-transparent bg-clip-text">
                            星空加值商城
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-indigo-950/50 px-3 py-1.5 rounded-full border border-indigo-500/20">
                            <span className="text-slate-400 text-sm">持有餘額</span>
                            <div className="flex items-center gap-1">
                                <span>💎</span>
                                <span className="font-bold text-indigo-300">{player.premiumGems}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-full hover:bg-slate-700 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                    {message && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 border ${message.type === 'error' ? 'bg-red-950/50 border-red-500/30 text-red-200' : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'}`}>
                            {message.type === 'error' ? <AlertTriangle size={20} className="shrink-0 text-red-400 mt-0.5" /> : <Crown size={20} className="shrink-0 text-emerald-400 mt-0.5" />}
                            <p>{message.text}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {PREMIUM_SHOP_ITEMS.map(item => {
                            const isBuying = buyingId === item.id;
                            const currentTargetBuffExpiry = player.activeBuffs ? (player.activeBuffs[item.buffKey] as number) : undefined;
                            const activeTimeLeft = getRemainingTime(currentTargetBuffExpiry);

                            return (
                                <div key={item.id} className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 flex flex-col hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all group">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-12 h-12 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                                            {item.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-100">{item.name}</h3>
                                            {activeTimeLeft ? (
                                                <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                    <span>生效中</span>
                                                    <span>剩餘 {activeTimeLeft}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-500 block mt-1">24小時時效</span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-sm text-slate-400 leading-relaxed mb-4 flex-1">
                                        {item.description}
                                    </p>

                                    <button
                                        onClick={() => handlePurchase(item)}
                                        disabled={isBuying}
                                        className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${isBuying ? 'bg-slate-700 text-slate-400 cursor-not-allowed' :
                                            player.premiumGems >= item.price
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 active:scale-[0.98]'
                                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                                            }`}
                                    >
                                        {isBuying ? (
                                            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <span>{activeTimeLeft ? '延長生效時間' : '購買啟用'}</span>
                                                <div className="flex items-center ml-2 border-l border-white/20 pl-2">
                                                    <span className="text-base mr-1">💎</span>
                                                    <span>{item.price}</span>
                                                </div>
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
