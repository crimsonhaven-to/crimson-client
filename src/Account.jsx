import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, User, LogOut, Copy, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { useAuth, useAccount } from './hooks';

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
      <div className="max-w-2xl w-full mx-auto px-6 py-12 space-y-8 my-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="border-b border-crimson-900 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight">Your Sanctuary</h2>
            <p className="text-sm text-crimson-400 font-medium">Synchronized with the dark network.</p>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-crimson-900/20 border border-crimson-900/60 rounded-xl text-crimson-400 hover:text-white hover:border-crimson-500 hover:bg-crimson-900/40 transition-all text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-crimson-900/10 border border-crimson-900/40 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-3 text-crimson-500">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Account Integrity</h3>
            </div>
            
            <div className="space-y-4 font-mono text-xs">
              <div>
                <p className="text-crimson-600 font-black uppercase mb-1">Public Signature (Account ID)</p>
                <div className="p-3 bg-crimson-950/80 border border-crimson-900 rounded-lg text-crimson-300 break-all select-all">
                  {publicKey}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-crimson-950/40 border border-crimson-900/40 rounded-xl">
                  <p className="text-[10px] text-crimson-600 font-black uppercase mb-1">Favorites</p>
                  <p className="text-2xl font-black text-white">{profile?.favorite_count || 0}</p>
                </div>
                <div className="p-4 bg-crimson-950/40 border border-crimson-900/40 rounded-xl">
                  <p className="text-[10px] text-crimson-600 font-black uppercase mb-1">Watch Progress</p>
                  <p className="text-2xl font-black text-white">{profile?.progress_count || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-crimson-900/5 border border-crimson-900/20 p-6 rounded-2xl flex items-start gap-4">
            <Info className="w-6 h-6 text-crimson-700 shrink-0 mt-1" />
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-crimson-300">Cryptography Notice</h4>
              <p className="text-xs text-crimson-500 leading-relaxed">
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
    <div className="max-w-md w-full mx-auto px-6 py-12 space-y-8 my-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-black text-white uppercase tracking-tight">Establish <span className="text-crimson-500">Link</span></h2>
        <p className="text-crimson-400 font-medium">Access your personal archives via mnemonic.</p>
      </div>

      {!showNewMnemonic ? (
        <div className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-crimson-600 ml-1">12-Word Mnemonic</label>
              <textarea 
                placeholder="word1 word2 word3..." 
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                className="w-full h-24 bg-crimson-950/50 border-2 border-crimson-900 rounded-2xl p-4 text-crimson-100 placeholder-crimson-800 focus:outline-none focus:border-crimson-500 transition-all font-medium resize-none text-sm"
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !mnemonic.trim()}
              className="w-full py-4 bg-crimson-500 hover:bg-crimson-400 disabled:bg-crimson-900/50 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_4px_20px_rgba(255,0,60,0.2)] flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>Establish Connection <Key className="w-4 h-4 group-hover:rotate-12 transition-transform" /></>
              )}
            </button>
          </form>

          {error && (
            <div className="p-4 bg-crimson-900/20 border border-crimson-500/30 rounded-xl text-xs text-crimson-400 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Link Error: {error}</span>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-crimson-900/50"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-crimson-950 px-4 text-crimson-800">Or initiate new vessel</span></div>
          </div>

          <button 
            onClick={handleGenerateMnemonic}
            className="w-full py-4 bg-crimson-950 border-2 border-crimson-900 hover:border-crimson-500 text-crimson-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            Generate New Identity <User className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
          <div className="p-6 bg-crimson-900/10 border-2 border-crimson-500 border-dashed rounded-2xl space-y-4">
            <div className="flex items-center gap-3 text-crimson-500">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white uppercase">Secret Manifest</h3>
            </div>
            <p className="text-xs text-crimson-300 leading-relaxed italic">
              "This is your only key. If you lose it, your manifestations will be lost to the abyss. Write it down. Store it safely."
            </p>
            <div className="p-4 bg-crimson-950 rounded-xl text-crimson-100 font-mono text-sm leading-relaxed border border-crimson-900 break-words select-all">
              {newMnemonic}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-crimson-900/40 hover:bg-crimson-900 text-white rounded-xl transition-all text-xs font-bold border border-crimson-800"
              >
                {copied ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy Mnemonic</>}
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => { setMnemonic(newMnemonic); setShowNewMnemonic(false); }}
            className="w-full py-4 bg-crimson-500 hover:bg-crimson-400 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_4px_20px_rgba(255,0,60,0.2)]"
          >
            I have secured the manifest
          </button>
          
          <button 
            onClick={() => setShowNewMnemonic(false)}
            className="w-full text-center text-xs text-crimson-700 hover:text-crimson-500 transition-colors font-bold uppercase tracking-wider"
          >
            Return to Link Establishment
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountPage;
