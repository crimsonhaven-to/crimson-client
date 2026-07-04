import { useState } from 'react';
import { Heart, Copy, Check, Wallet } from 'lucide-react';
import { useTitle } from './hooks';

// The wallets we accept contributions through. Symbol drives the little glyph,
// `accent` keeps each row's chip on-brand for the coin while staying crimson-lit.
const WALLETS = [
  { symbol: 'BTC', name: 'Bitcoin', address: 'bc1q2qwx39d0y4nmphmc8he7sq4cjx0kzet7kwlus4' },
  { symbol: 'ETH', name: 'Ethereum', address: '0x985D9B1B48CA4f70d35291B21d51aEcAA1E30f24' },
  { symbol: 'XRP', name: 'Ripple', address: 'rDk8eR7srxFB6QetHgKJWPHGyabHefgxXH' },
];

// A single wallet row: coin label + monospace address + tap-to-copy button.
const WalletRow = ({ symbol, name, address }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (insecure context / old browser) — fail quietly.
    }
  };

  return (
    <div className="group relative flex items-center gap-4 sm:gap-6 p-5 sm:p-6 bg-crimson-950/40 border border-crimson-900/60 rounded-3xl hover:border-crimson-500/50 hover:bg-crimson-900/20 transition-all duration-500 overflow-hidden shadow-2xl">
      <div className="absolute inset-0 bg-crimson-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-crimson-500/10 rounded-2xl border border-crimson-500/20 group-hover:bg-crimson-500/20 group-hover:scale-105 transition-all duration-500 relative z-10">
        <span className="text-sm sm:text-base font-black text-crimson-400 tracking-tight uppercase">{symbol}</span>
      </div>

      <div className="flex-1 min-w-0 relative z-10">
        <h3 className="text-base sm:text-lg font-black text-crimson-50 uppercase tracking-tight group-hover:text-crimson-400 transition-colors">
          {name}
        </h3>
        <p className="font-mono text-[11px] sm:text-xs text-crimson-300/70 break-all mt-1 leading-relaxed">
          {address}
        </p>
      </div>

      <button
        onClick={copy}
        aria-label={`Copy ${name} address`}
        className="relative z-10 shrink-0 p-3 rounded-2xl bg-crimson-900/30 border border-crimson-800/50 text-crimson-400 hover:bg-crimson-500 hover:text-white hover:border-crimson-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-crimson-500/50"
      >
        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
      </button>
    </div>
  );
};

const SupportUsPage = () => {
  useTitle('Support the Haven');

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-3">
        <h2 className="text-4xl sm:text-5xl font-black text-crimson-50 uppercase tracking-tighter flex items-center gap-4 leading-none">
          <Heart className="w-10 h-10 text-crimson-500 fill-crimson-500/20 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]" /> Support Us
        </h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">Protocol: Sustaining the Sanctuary</p>
      </div>

      <div className="space-y-8 text-sm sm:text-base text-crimson-100/70 leading-relaxed text-justify font-medium">
        <p>
          <strong className="text-crimson-50 font-black tracking-tight uppercase">crimsonhaven</strong> is a performance-optimized high-fidelity manifest built for the community.
          Maintaining the infrastructure, scraping engines, and dark network nodes requires constant calibration and resources.
        </p>

        <p>
          If you find value in this sanctuary and wish to help us keep the data stream alive, consider a contribution to one of the
          wallets below. Every transmission, however small, ensures the longevity of the Haven.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] text-crimson-500 font-black uppercase tracking-[0.3em] flex items-center gap-3">
          <Wallet className="w-4 h-4" /> Crypto Channels
        </h3>
        {WALLETS.map((wallet) => (
          <WalletRow key={wallet.symbol} {...wallet} />
        ))}
      </div>

      <div className="bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 p-6 rounded-3xl font-mono text-[10px] text-crimson-400/80 space-y-2 shadow-inner relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-5">
           <Heart className="w-12 h-12 text-crimson-500" />
        </div>
        <h3 className="font-black text-crimson-50 mb-3 uppercase tracking-widest border-b border-crimson-900/50 pb-2 flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-crimson-500"></div>
           Contribution Diagnostics
        </h3>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> All manifestations are voluntary and non-reversible.</p>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> Double-check the address before broadcasting any transaction.</p>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> Your support strengthens the dark network bonds.</p>
      </div>
    </div>
  );
};

export default SupportUsPage;
