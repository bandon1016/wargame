import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sword, Loader2 } from 'lucide-react';

export const AuthScreen: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onSignIn();
            } else {
                if (!nickname.trim()) throw new Error('請輸入角色名稱');
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            nickname: nickname.trim()
                        }
                    }
                });
                if (error) throw error;
                setMessage('註冊成功！系統已為您建立冒險者檔案。按登入進入遊戲。');
                setIsLogin(true);
            }
        } catch (error: any) {
            let errorMsg = error.message;
            if (errorMsg === 'Email not confirmed') {
                errorMsg = '電子信箱尚未驗證，請先至您的信箱查看驗證信。';
            } else if (errorMsg === 'Invalid login credentials') {
                errorMsg = '電子信箱或密碼錯誤。';
            }
            setMessage(errorMsg || '發生錯誤，請重試。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0e1a] text-white p-4">
            <div className="glass-panel p-8 rounded-2xl w-full max-w-md relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-game-accent/10 rounded-full blur-3xl z-0" />

                <div className="relative z-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-game-accent to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-game-accent/20 anim-float">
                            <Sword size={32} />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-center mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        浪跡戰域
                    </h1>
                    <p className="text-gray-400 text-center text-sm mb-8">Wanderer's Realm - 現實地理 RPG</p>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {!isLogin && (
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">角色名稱 (Nickname)</label>
                                <input
                                    type="text"
                                    required={!isLogin}
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 outline-none focus:border-game-accent/50 transition-colors"
                                    placeholder=""
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">電子信箱 (Email)</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 outline-none focus:border-game-accent/50 transition-colors"
                                placeholder="example@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">登入密碼 (Password)</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 outline-none focus:border-game-accent/50 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-sm ${message.includes('成功') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-game-accent to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-game-accent/20 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? '進入遊戲' : '創造角色')}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-400">
                        {isLogin ? '第一次來到這個世界？' : '已經是經驗豐富的冒險者？'}
                        <button
                            onClick={() => { setIsLogin(!isLogin); setMessage(''); }}
                            className="ml-2 text-game-accent hover:text-white font-bold transition-colors"
                        >
                            {isLogin ? '註冊帳號' : '返回登入'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
