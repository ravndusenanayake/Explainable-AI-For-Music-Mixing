import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Music, LayoutDashboard, SlidersHorizontal, MicVocal, RefreshCw } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';

const Layout = () => {
  const { processedAudioUrl, resetContext } = useAudioContext();
  const navigate = useNavigate();

  const handleReset = () => {
    resetContext();
    navigate('/');
  };

  if (!processedAudioUrl) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-20 border-b border-white/5 bg-black/30 backdrop-blur-xl px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-violet-500/10 rounded-xl border border-blue-500/20 shadow-lg">
              <Music className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
              Mix Assistant
            </span>
          </div>

          <nav className="flex items-center gap-1 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 shadow-inner">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  isActive ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] border border-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </NavLink>
          </nav>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-white/5 transition-all group"
          >
            <RefreshCw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
            New Track
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
