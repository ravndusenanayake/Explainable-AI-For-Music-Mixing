import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import Layout from './components/Layout';
import { Music } from 'lucide-react';

// Lazy loading pages for fast initial load
const UploadPage = lazy(() => import('./pages/UploadPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));

// Aesthetic Loading Spinner for Suspense fallback
const LoadingFallback = () => (
  <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
    <div className="relative">
      <div className="w-24 h-24 border-[4px] border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="w-16 h-16 border-[4px] border-white/5 border-b-violet-500 rounded-full animate-spin absolute top-4 left-4" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Music className="w-6 h-6 text-blue-400 animate-pulse" />
      </div>
    </div>
  </div>
);

function App() {
  return (
    <AudioProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<UploadPage />} />
            </Route>
            <Route path="/dashboard" element={<EditorPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AudioProvider>
  );
}

export default App;
