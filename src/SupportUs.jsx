import { Heart, ExternalLink, Coffee } from 'lucide-react';
import { useTitle } from './hooks';

const SupportUsPage = () => {
  useTitle('Support the Haven');

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-3">
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter flex items-center gap-4 leading-none">
          <Heart className="w-10 h-10 text-crimson-500 fill-crimson-500/20 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]" /> Support Us
        </h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">Protocol: Sustaining the Sanctuary</p>
      </div>

      <div className="space-y-8 text-sm sm:text-base text-crimson-100/70 leading-relaxed text-justify font-medium">
        <p>
          <strong className="text-white font-black tracking-tight uppercase">crimsonhaven</strong> is a performance-optimized high-fidelity manifest built for the community. 
          Maintaining the infrastructure, scraping engines, and dark network nodes requires constant calibration and resources.
        </p>
        
        <p>
          If you find value in this sanctuary and wish to help us maintain the data stream or simply fuel the developers' next coding ritual, 
          consider a contribution via Ko-fi. Every bit of support ensures the longevity of the Haven.
        </p>
      </div>

      <div className="pt-6">
        <a
          href="https://ko-fi.com/crimsonhaven"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center justify-between gap-6 p-8 bg-crimson-950/40 border border-crimson-900/60 rounded-3xl hover:bg-crimson-900/20 hover:border-crimson-500/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden shadow-2xl"
        >
          <div className="absolute inset-0 bg-crimson-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="p-4 bg-crimson-500/10 rounded-2xl border border-crimson-500/20 group-hover:bg-crimson-500/20 group-hover:scale-110 transition-all duration-500">
              <Coffee className="w-8 h-8 text-crimson-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight group-hover:text-crimson-400 transition-colors">
                Support on Ko-fi
              </h3>
              <p className="text-[9px] text-crimson-600 font-black uppercase tracking-[0.3em] mt-2 group-hover:text-crimson-500 transition-colors">
                Secure External Redirect
              </p>
            </div>
          </div>
          
          <div className="p-3 rounded-full bg-crimson-900/20 group-hover:bg-crimson-500 transition-all duration-500 group-hover:translate-x-2">
             <ExternalLink className="w-5 h-5 text-crimson-600 group-hover:text-white" />
          </div>
        </a>
      </div>

      <div className="bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 p-6 rounded-3xl font-mono text-[10px] text-crimson-400/80 space-y-2 shadow-inner relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-5">
           <Heart className="w-12 h-12 text-crimson-500" />
        </div>
        <p className="font-black text-crimson-50 mb-3 uppercase tracking-widest border-b border-crimson-900/50 pb-2 flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-crimson-500"></div>
           Contribution Diagnostics
        </p>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> All manifestations are voluntary and non-reversible.</p>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> Resources are allocated to node scaling and stability.</p>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> Your support strengthens the dark network bonds.</p>
      </div>
    </div>
  );
};

export default SupportUsPage;
