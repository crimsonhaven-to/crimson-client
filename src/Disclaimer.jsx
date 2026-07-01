import { Scale, Shield, Eye, Cookie, FileText, RefreshCw } from 'lucide-react';
import { useTitle, DMCA_MAIL } from './hooks';

const Section = ({ icon, title, children }) => (
  <div className="space-y-6">
    <h3 className="text-[10px] font-black text-crimson-500 uppercase tracking-[0.4em] flex items-center gap-4">
      {icon}
      {title}
      <div className="h-px bg-crimson-900/30 flex-grow"></div>
    </h3>
    <div className="space-y-4 text-sm sm:text-base text-crimson-100/70 leading-relaxed text-justify font-medium">
      {children}
    </div>
  </div>
);

const DisclaimerPage = () => {
  useTitle('Disclaimer & Privacy');

  return (
    <div className="max-w-3xl w-full mx-auto px-6 py-20 space-y-12 my-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="border-b border-crimson-900/30 pb-8 space-y-3">
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tighter flex items-center gap-4 leading-none">
          <Scale className="w-10 h-10 text-crimson-500 drop-shadow-[0_0_15px_rgba(255,0,60,0.4)]" /> Disclaimer
        </h2>
        <p className="text-[10px] text-crimson-400 font-black uppercase tracking-[0.3em] opacity-80">Protocol: Legal &amp; Privacy Manifest</p>
      </div>

      <Section icon={<Shield className="w-4 h-4" />} title="DMCA / Disclaimer Policy">
        <p>
          <strong className="text-white font-black tracking-tight uppercase">crimsonhaven</strong> does not host, store, or
          upload any video, media file, or content on its own servers. The platform purely indexes and embeds material that
          was uploaded to third-party online hosting services by their respective users.
        </p>
        <p>
          All trademarks, videos, trade names, service marks, copyrighted works, and logos referenced herein belong to their
          respective owners and companies. crimsonhaven holds no responsibility for what other people upload to third-party
          sites. We urge all copyright owners to recognize that the links contained within this site are located somewhere
          else on the web, and that any embedded media originates from external sources.
        </p>
        <p>
          If you have any legal issues, please contact the appropriate media file owners or the host sites directly.
          crimsonhaven is not the correct party to address regarding the takedown of content it does not store.
          If you wish for the removal of a link to a media file, you can contact us at {DMCA_MAIL} with the exact URL of the media file in question and we will do our best to assist you.
        </p>
      </Section>

      <Section icon={<Eye className="w-4 h-4" />} title="Privacy Policy">
        <p>
          This privacy policy is intended to inform you about the types of information gathered by crimsonhaven when you
          visit and use this site. We are committed to keeping data collection minimal and respecting the anonymity of
          everyone who passes through the Haven.
        </p>
      </Section>

      <Section icon={<FileText className="w-4 h-4" />} title="Log Files">
        <p>
          We may automatically gather certain non-personally identifiable information about your use of crimsonhaven and
          store it in log files. This information may include internet protocol (IP) addresses, browser type, internet
          service provider (ISP), referring and exit pages, operating system, and date/time stamps. We use this data — which
          does not identify individual users — solely to monitor the health of our nodes and improve the quality of the
          service. Out of respect for your privacy, we do not link this automatically-collected data to any personally
          identifiable information.
        </p>
      </Section>

      <Section icon={<Cookie className="w-4 h-4" />} title="Cookies">
        <p>
          A cookie is a small text file stored on your device for record-keeping purposes. crimsonhaven keeps its footprint
          light: we use a session identifier so you can stay logged in and so the site can remember your preferences while
          you browse. You are free to decline cookies, but by doing so some features — such as your account, favorites, and
          watch history — may not function correctly. We do not link the information stored in cookies to any personally
          identifiable information you submit while using crimsonhaven.
        </p>
      </Section>

      <Section icon={<RefreshCw className="w-4 h-4" />} title="Changes to this Policy">
        <p>
          We may periodically update this policy as the Haven evolves. Any material changes will be reflected on this page,
          and the updated version supersedes all prior revisions. We encourage you to revisit this page from time to time so
          you remain aware of how your data is handled.
        </p>
      </Section>

      <div className="bg-crimson-950/30 backdrop-blur-md border border-crimson-900/40 p-6 rounded-3xl font-mono text-[10px] text-crimson-400/80 space-y-2 shadow-inner relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-5">
          <Scale className="w-12 h-12 text-crimson-500" />
        </div>
        <h3 className="font-black text-crimson-50 mb-3 uppercase tracking-widest border-b border-crimson-900/50 pb-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-crimson-500"></div>
          Compliance Diagnostics
        </h3>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> No media assets are hosted or stored on crimsonhaven servers.</p>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> Collected log data is anonymous and never personally linked.</p>
        <p className="flex items-center gap-2"><span className="text-crimson-700 font-black">•</span> Takedown requests belong with the upstream host sites.</p>
      </div>
    </div>
  );
};

export default DisclaimerPage;
