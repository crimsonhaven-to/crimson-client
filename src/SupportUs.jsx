import { Heart, ExternalLink, Coffee } from 'lucide-react';
import { useTitle } from './hooks';

const SupportUsPage = () => {
  useTitle('Support the Haven');

  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-12 space-y-8 my-auto animate-in fade-in duration-700">
      <div className="border-b border-crimson-900 pb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Heart className="text-crimson-500 fill-crimson-500/20" /> Support Us
        </h2>
        <p className="text-sm text-crimson-400 font-medium uppercase tracking-widest">Protocol: Sustaining the Sanctuary</p>
      </div>

      <div className="space-y-6 text-sm text-crimson-200/80 leading-relaxed text-justify">
        <p>
          <strong className="text-white uppercase tracking-tighter">crimsonhaven</strong> is a performance-optimized high-fidelity manifest built for the community. 
          Maintaining the infrastructure, scraping engines, and dark network nodes requires constant calibration and resources.
        </p>
        
        <p>
          If you find value in this sanctuary and wish to help us maintain the data stream or simply fuel the developers' next coding ritual, 
          consider a contribution via Ko-fi. Every bit of support ensures the longevity of the Haven.
        </p>
      </div>

      <div className="pt-4">
        <a
          href="https://ko-fi.com/crimsonhaven"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center justify-between gap-4 p-6 bg-crimson-900/20 border border-crimson-900/50 rounded-2xl hover:bg-crimson-900/40 hover:border-crimson-500 transition-all shadow-lg overflow-hidden"
        >
          <div className="absolute inset-0 bg-crimson-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-crimson-500/20 rounded-xl border border-crimson-500/30">
              <Coffee className="w-6 h-6 text-crimson-400 group-hover:text-crimson-500 transition-colors" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide group-hover:text-crimson-400 transition-colors">
                Support on Ko-fi
              </h3>
              <p className="text-[10px] text-crimson-500 font-bold uppercase tracking-[0.2em] mt-1">
                External Redirect Link
              </p>
            </div>
          </div>
          
          <ExternalLink className="w-5 h-5 text-crimson-700 group-hover:text-crimson-500 group-hover:translate-x-1 transition-all" />
        </a>
      </div>

      <div className="bg-crimson-950/50 backdrop-blur-md border border-crimson-900/50 p-4 rounded-xl font-mono text-[10px] text-crimson-300 space-y-1">
        <p className="font-bold text-white mb-1 uppercase tracking-tighter opacity-50">// Contribution Diagnostics</p>
        <p>• All manifestations are voluntary and non-reversible.</p>
        <p>• Resources are allocated to node scaling and manifest stability.</p>
        <p>• Your support strengthens the dark network bonds.</p>
      </div>
    </div>
  );
};

export default SupportUsPage;
