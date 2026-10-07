import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import Layout from './components/Layout';
import { Music, AlertTriangle } from 'lucide-react';

import { Toaster } from 'react-hot-toast';

// Lazy loading pages for fast initial load
const UploadPage = lazy(() => import('./pages/UploadPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));

// Error Boundary to prevent full-page black screens on render errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
          <div className="bg-[#1a1a2e] border border-red-500/30 rounded-xl p-8 max-w-md text-center shadow-2xl">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/dashboard';
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-2.5 rounded-lg transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              Reload Editor
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <AudioProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid #333',
              fontSize: '12px',
              fontWeight: 'bold',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#1a1a1a',
              },
            },
          }}
        />
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
    </ErrorBoundary>
  );
}

export default App;
