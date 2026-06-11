import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, User, LogOut, Copy, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { useAuth, useAccount, useTitle } from './hooks';

const AccountPage = () => {
  const { login, logout, createNewMnemonic, isAuthenticated, publicKey, loading, error } = useAuth();
  const { profile } = useAccount();
  useTitle(isAuthenticated ? 'Your Sanctuary' : 'Establish Link');
  const [mnemonic, setMnemonic] = useState('');
  const [newMnemonic, setNewMnemonic] = useState('');
  const [showNewMnemonic, setShowNewMnemonic] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const success = await login(mnemonic.trim());
    if (success) {
      navigate('/');
    }
  };

  const handleGenerateMnemonic = () => {
    const m = createNewMnemonic();
    setNewMnemonic(m);
    setShowNewMnemonic(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(newMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isAuthenticated) {
    return (
      <div className="max-w-2xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="border-b border-crimson-900/30 pb-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter">Your <span className="text-crimson-500">Sanctuary</span></h2>
            <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">Synchronized with the dark network</p>
          </div>
          <button 
            onClick={logout}
            className="group flex items-center gap-2.5 px-6 py-3 bg-crimson-950/40 border border-crimson-900/60 rounded-2xl text-crimson-500 hover:text-white hover:border-crimson-500 hover:bg-crimson-900/40 transition-all text-[10px] font-black uppercase tracking-widest shadow-xl"
          >
            <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> Logout
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="bg-crimson-950/30 backdrop-blur-xl border border-crimson-900/40 p-8 sm:p-10 rounded-[2.5rem] space-y-8 shadow-2xl relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-crimson-500/5 blur-[80px] rounded-full"></div>

            <div className="flex items-center gap-4 text-crimson-500 relative z-10">
              <ShieldCheck className="w-8 h-8 drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" />
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Account Integrity</h3>
            </div>
            
            <div className="space-y-8 font-mono text-xs relative z-10">
              <div className="space-y-3">
                <p className="text-[10px] text-crimson-600 font-black uppercase tracking-[0.2em] mb-1 opacity-70">Public Signature (Account ID)</p>
                <div className="p-5 bg-crimson-950/80 border border-crimson-900/60 rounded-2xl text-crimson-400 break-all select-all font-mono shadow-inner">
                  {publicKey}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-crimson-950/40 border border-crimson-900/40 rounded-2xl shadow-lg group hover:border-crimson-500/30 transition-all">
                  <p className="text-[9px] text-crimson-600 font-black uppercase tracking-[0.3em] mb-2 group-hover:text-crimson-500 transition-colors">Favorites</p>
                  <p className="text-4xl font-black text-white tracking-tighter">{profile?.favorite_count || 0}</p>
                </div>
                <div className="p-6 bg-crimson-950/40 border border-crimson-900/40 rounded-2xl shadow-lg group hover:border-crimson-500/30 transition-all">
                  <p className="text-[9px] text-crimson-600 font-black uppercase tracking-[0.3em] mb-2 group-hover:text-crimson-500 transition-colors">Manifests</p>
                  <p className="text-4xl font-black text-white tracking-tighter">{profile?.progress_count || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-crimson-500/5 backdrop-blur-md border border-crimson-900/30 p-8 rounded-3xl flex items-start gap-5 relative">
            <div className="p-3 rounded-2xl bg-crimson-900/20">
               <Info className="w-6 h-6 text-crimson-500" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-black text-crimson-100 uppercase tracking-widest">Cryptography Notice</h4>
              <p className="text-xs text-crimson-300/60 leading-relaxed font-medium">
                Your account is bound to your 12-word mnemonic. We do not store your private keys. 
                If you lose your mnemonic, your data is lost forever in the void.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="text-center space-y-3">
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter">Establish <span className="text-crimson-500">Link</span></h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">Access your personal archives via mnemonic</p>
      </div>

      {!showNewMnemonic ? (
        <div className="space-y-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-crimson-700 ml-1">12-Word Mnemonic Manifest</label>
              <textarea 
                placeholder="word1 word2 word3..." 
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                className="w-full h-32 bg-crimson-950/30 border border-crimson-900/50 rounded-3xl p-5 text-crimson-50 placeholder-crimson-900 focus:outline-none focus:border-crimson-500 focus:shadow-[0_0_30px_rgba(255,0,60,0.1)] transition-all font-bold resize-none text-sm backdrop-blur-md"
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !mnemonic.trim()}
              className="group relative w-full py-5 bg-crimson-600 hover:bg-crimson-500 disabled:bg-crimson-900/50 text-white font-black uppercase tracking-[0.2em] text-xs rounded-3xl transition-all shadow-[0_15px_30px_rgba(255,0,60,0.2)] flex items-center justify-center gap-3 active:scale-95"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>Establish Connection <Key className="w-4 h-4 group-hover:rotate-12 transition-transform" /></>
              )}
            </button>
          </form>

          {error && (
            <div className="p-5 bg-crimson-500/5 border border-crimson-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-crimson-400 flex items-center gap-4 shadow-2xl animate-in shake duration-500">
              <AlertCircle className="w-5 h-5 text-crimson-500 shrink-0" />
              <span>Link Error: {error}</span>
            </div>
          )}

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-crimson-900/30"></div></div>
            <div className="relative flex justify-center"><span className="bg-crimson-950 px-6 text-[10px] font-black uppercase tracking-[0.3em] text-crimson-800">New Vessel</span></div>
          </div>

          <button 
            onClick={handleGenerateMnemonic}
            className="w-full py-5 bg-crimson-950/40 border border-crimson-900/60 hover:border-crimson-600 hover:bg-crimson-900/20 text-crimson-500 hover:text-crimson-400 rounded-3xl transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 shadow-xl"
          >
            Generate New Identity <User className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-8 animate-in zoom-in-95 duration-700">
          <div className="p-8 sm:p-10 bg-crimson-950/40 backdrop-blur-xl border border-crimson-500/30 border-dashed rounded-[2.5rem] space-y-6 shadow-2xl relative overflow-hidden">
             {/* Decorative background glow */}
             <div className="absolute -top-24 -right-24 w-48 h-48 bg-crimson-500/10 blur-[80px] rounded-full"></div>

            <div className="flex items-center gap-4 text-crimson-500 relative z-10">
              <ShieldCheck className="w-8 h-8 drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" />
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Secret Manifest</h3>
            </div>
            <p className="text-xs text-crimson-300 font-medium leading-relaxed italic relative z-10 opacity-70">
              "This is your only key. If you lose it, your manifestations will be lost to the abyss. Store it safely."
            </p>
            <div className="p-6 bg-crimson-950/80 rounded-2xl text-crimson-50 font-mono text-sm leading-relaxed border border-crimson-900 shadow-inner break-words select-all relative z-10">
              {newMnemonic}
            </div>
            <div className="flex gap-3 relative z-10">
              <button 
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-3 py-4 bg-crimson-900/20 hover:bg-crimson-900/40 text-crimson-100 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest border border-crimson-800/50"
              >
                {copied ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy Mnemonic</>}
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => { setMnemonic(newMnemonic); setShowNewMnemonic(false); }}
            className="w-full py-5 bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-[0.2em] text-xs rounded-3xl transition-all shadow-[0_15px_30px_rgba(255,0,60,0.3)] active:scale-95"
          >
            I have secured the manifest
          </button>
          
          <button 
            onClick={() => setShowNewMnemonic(false)}
            className="w-full text-center text-[10px] text-crimson-700 hover:text-crimson-500 transition-colors font-black uppercase tracking-[0.2em]"
          >
            Return to Link Establishment
          </button>
        </div>
      )}
    </div>
  );
};
    </div>
  );
};

export default AccountPage;
