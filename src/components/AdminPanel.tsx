import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, X, Gift, Diamond } from 'lucide-react';
import { PREMIUM_SHOP_ITEMS } from '../types/game';

interface AdminPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
    const [targetUid, setTargetUid] = useState('');
    const [gemAmount, setGemAmount] = useState(100);
    const [selectedBuffKey, setSelectedBuffKey] = useState(PREMIUM_SHOP_ITEMS[0].buffKey);
    const [buffDurationDays, setBuffDurationDays] = useState(1);

    const [loadingAction, setLoadingAction] = useState<'gems' | 'buff' | 'lookup' | null>(null);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    const resolveUidToUuid = async (uid: string): Promise<{ uuid: string | null, error?: string }> => {
        const cleanUid = uid.trim().toUpperCase();
        if (!cleanUid) return { uuid: null };

        const { data, error } = await supabase.rpc('secure_admin_resolve_uid', {
            p_uid: cleanUid
        });

        if (error) {
            console.error('UID Resolve RPC Error:', error);
            return { uuid: null, error: error.message };
        }
        return { uuid: data as string };
    };

    if (!isOpen) return null;

    const handleGrantGems = async () => {
        if (!targetUid || gemAmount <= 0) {
            setMessage({ text: '請輸入目標 UID 與大於 0 的靈石數量', type: 'error' });
            return;
        }

        setLoadingAction('gems');
        setMessage(null);

        try {
            const { uuid, error: lookupError } = await resolveUidToUuid(targetUid);
            if (!uuid) {
                setMessage({ text: lookupError || `找不到玩家 UID: ${targetUid}`, type: 'error' });
                setLoadingAction(null);
                return;
            }

            const confirmText = `[管理員操作]\n確定要發送 ${gemAmount} 顆 台灣藍寶靈石 給 ${targetUid} (${uuid}) 嗎？`;
            if (!window.confirm(confirmText)) {
                setLoadingAction(null);
                return;
            }

            const { data, error } = await supabase.rpc('secure_admin_grant_gems', {
                p_target_id: uuid,
                p_amount: gemAmount
            });

            if (error) throw error;
            setMessage({ text: `成功發送 ${gemAmount} 顆靈石！玩家: ${targetUid} 新餘額: ${data.new_balance}`, type: 'success' });
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Admin Grant Error:', error);
            setMessage({ text: error.message || '發送失敗，請確認是否具備管理員權限', type: 'error' });
        } finally {
            setLoadingAction(null);
        }
    };

    const handleGrantBuff = async () => {
        if (!targetUid || buffDurationDays <= 0) {
            setMessage({ text: '請輸入目標 UID 與大於 0 的天數', type: 'error' });
            return;
        }

        setLoadingAction('buff');
        setMessage(null);

        try {
            const { uuid, error: lookupError } = await resolveUidToUuid(targetUid);
            if (!uuid) {
                setMessage({ text: lookupError || `找不到玩家 UID: ${targetUid}`, type: 'error' });
                setLoadingAction(null);
                return;
            }

            const buffName = PREMIUM_SHOP_ITEMS.find(i => i.buffKey === selectedBuffKey)?.name || selectedBuffKey;
            const confirmText = `[管理員操作]\n確定要發送【${buffName}】(${buffDurationDays}天) 給 ${targetUid} (${uuid}) 嗎？`;
            if (!window.confirm(confirmText)) {
                setLoadingAction(null);
                return;
            }

            const { error } = await supabase.rpc('secure_admin_grant_buff', {
                p_target_id: uuid,
                p_buff_key: String(selectedBuffKey),
                p_duration_ms: buffDurationDays * 24 * 60 * 60 * 1000
            });

            if (error) throw error;
            setMessage({ text: `成功發送 ${buffName} 給玩家: ${targetUid}！`, type: 'success' });
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Admin Grant Error:', error);
            setMessage({ text: error.message || '發送失敗，請確認是否具備管理員權限', type: 'error' });
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-slate-900 border-2 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)] rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-red-950/80 p-4 border-b border-red-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="text-red-400 animate-pulse" size={24} />
                        <h2 className="text-xl font-bold text-red-100 uppercase tracking-widest">
                            開發者最高權限後台
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-full hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {message && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 border ${message.type === 'error' ? 'bg-red-950/50 border-red-500/30 text-red-200' : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'}`}>
                            {message.type === 'error' ? <ShieldAlert size={20} className="shrink-0 mt-0.5" /> : <Gift size={20} className="shrink-0 mt-0.5" />}
                            <p>{message.text}</p>
                        </div>
                    )}

                    <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">目標玩家 UID (例如: G-0000)</label>
                            <input
                                type="text"
                                value={targetUid}
                                onChange={e => setTargetUid(e.target.value)}
                                placeholder="輸入玩家 UID..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-red-500 transition-colors font-mono text-sm uppercase"
                            />
                        </div>

                        <div className="w-full h-px bg-slate-700/50 my-4" />

                        {/* Gems Grant */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-indigo-400 mb-1 flex items-center gap-1">
                                    <Diamond size={14} /> 發放藍寶靈石數量
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={gemAmount}
                                    onChange={e => setGemAmount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-slate-900 border border-indigo-900/50 rounded-lg p-3 text-indigo-200 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleGrantGems}
                                    disabled={loadingAction === 'gems'}
                                    className="w-full h-[46px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                                >
                                    {loadingAction === 'gems' ? '執行中...' : '發放靈石'}
                                </button>
                            </div>
                        </div>

                        <div className="w-full h-px bg-slate-700/50 my-4" />

                        {/* Buff Grant */}
                        <div className="space-y-4">
                            <label className="block text-sm text-emerald-400 mb-1 flex items-center gap-1">
                                <Gift size={14} /> 發放商城道具 (直接啟動 Buff)
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <select
                                    value={String(selectedBuffKey)}
                                    onChange={e => setSelectedBuffKey(e.target.value as "eliteEncounterExpiry" | "hsrPassExpiry" | "luckyCloverExpiry" | "goddessBlessingExpiry" | "hornOfPlentyExpiry")}
                                    className="w-full bg-slate-900 border border-emerald-900/50 rounded-lg p-3 text-emerald-200 focus:outline-none focus:border-emerald-500"
                                >
                                    {PREMIUM_SHOP_ITEMS.map(item => (
                                        <option key={item.id} value={String(item.buffKey)}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={buffDurationDays}
                                        onChange={e => setBuffDurationDays(parseInt(e.target.value) || 1)}
                                        className="w-full bg-slate-900 border border-emerald-900/50 rounded-lg p-3 text-emerald-200 focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="text-slate-400 text-sm whitespace-nowrap">天數</span>
                                </div>
                            </div>
                            <button
                                onClick={handleGrantBuff}
                                disabled={loadingAction === 'buff'}
                                className="w-full h-[46px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                            >
                                {loadingAction === 'buff' ? '執行中...' : '發放並啟動道具'}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
