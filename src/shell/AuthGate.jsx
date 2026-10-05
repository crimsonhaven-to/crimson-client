import { Routes, Route } from 'react-router-dom';
import MeshBackground from './MeshBackground';
import { HOSTED_IN } from '../api/config';
// Eager: it's the first paint for logged-out visitors, so a lazy chunk would add a
// round-trip on the critical path.
import LoginWall from '../account/Login';
import VerifyEmail from '../account/VerifyEmail';
import ResetPassword from '../account/ResetPassword';
import SwitchBackendLink from '../native/SwitchBackendLink';

export default function AuthGate() {
  return (
    <div className="min-h-screen bg-crimson-950 text-crimson-100 font-sans selection:bg-crimson-500 selection:text-white flex flex-col relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <MeshBackground />
      </div>
      <div className="flex-grow z-10 flex flex-col justify-center">
        <Routes>
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="*" element={<LoginWall />} />
        </Routes>
      </div>
      <footer className="w-full text-center py-6 px-4 z-10 relative space-y-3">
        <SwitchBackendLink />
        <p className="text-[10px] font-medium tracking-wide text-crimson-700 uppercase">
          crimsonhaven · members only · your data stays in {HOSTED_IN}
        </p>
      </footer>
    </div>
  );
}
