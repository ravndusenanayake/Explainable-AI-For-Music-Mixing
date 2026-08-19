import React, { createContext, useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { get, set } from 'idb-keyval';

const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const [eqSettings, setEqSettings] = useState({
    lcFreq: 50,
    hcFreq: 16000,
    enabledModules: new Set(['CUT FILTER', 'DE-ESSER I', 'COMPRESSOR I', 'EQ I', 'SATURATOR'])
  });

  // ==========================================
  // NEW: ADVANCED DAW STATE
  // ==========================================
  
  // Array of uploaded files: { id, file, url, name, type }
  const [mediaPool, setMediaPool] = useState([]);

  const defaultEffects = {
    eq: { 
      enabled: false, 
      bands: [
        { id: 1, type: 'highpass', freq: 80, gain: 0, q: 1 },
        { id: 2, type: 'peaking', freq: 500, gain: 0, q: 1 },
        { id: 3, type: 'peaking', freq: 2000, gain: 0, q: 1 },
        { id: 4, type: 'highshelf', freq: 8000, gain: 0, q: 1 }
      ]
    },
    deEsser: { enabled: false, amount: 50 },
    compressor: { enabled: false, threshold: -15, ratio: 4 },
    reverb: { enabled: false, type: 'valhalla', mix: 20 }, // Added Valhalla style default
    delay: { enabled: false, time: '1/4', mix: 10 },
    saturation: { enabled: false, drive: 20 }
  };

  const [tracks, setTracks] = useState([
    { id: 't1', name: 'Lead Vocal', type: 'vocal', color: 'rose', clips: [], pan: 0, volume: 1, isMuted: false, isSoloed: false, effects: structuredClone(defaultEffects) },
    { id: 't2', name: 'Backing Vocal', type: 'vocal', color: 'pink', clips: [], pan: 0, volume: 1, isMuted: false, isSoloed: false, effects: structuredClone(defaultEffects) },
    { id: 't3', name: 'Main Instrumental', type: 'instrumental', color: 'cyan', clips: [], pan: 0, volume: 1, isMuted: false, isSoloed: false, effects: structuredClone(defaultEffects) },
    { id: 't4', name: 'Drums / Beat', type: 'instrumental', color: 'blue', clips: [], pan: 0, volume: 1, isMuted: false, isSoloed: false, effects: structuredClone(defaultEffects) },
  ]);

  const [masterVolume, setMasterVolume] = useState(1);

  const [isProjectLoaded, setIsProjectLoaded] = useState(false);

  // Initialize from IndexedDB
  useEffect(() => {
    const loadProject = async () => {
      try {
        const saved = await get('saved_project');
        if (saved) {
          // Re-create object URLs for files in mediaPool since URL.createObjectURL does not persist
          const restoredMediaPool = saved.mediaPool.map(m => ({
            ...m,
            url: URL.createObjectURL(m.file)
          }));
          setMediaPool(restoredMediaPool);
          
          // Re-link files in track clips to avoid missing or detached file references
          const restoredTracks = saved.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => {
              const media = restoredMediaPool.find(m => m.id === clip.mediaId);
              return { ...clip, file: media ? media.file : clip.file };
            })
          }));
          
          setTracks(restoredTracks);
        }
      } catch (err) {
        console.error("Failed to load project from IndexedDB", err);
      } finally {
        setIsProjectLoaded(true);
      }
    };
    loadProject();
  }, []);

  // Auto-save to IndexedDB (debounced)
  useEffect(() => {
    if (!isProjectLoaded) return;
    const timer = setTimeout(() => {
      set('saved_project', { tracks, mediaPool }).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [tracks, mediaPool, isProjectLoaded]);

  const updateTrackEffect = (trackId, effectKey, updates) => {
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          effects: {
            ...t.effects,
            [effectKey]: { ...t.effects[effectKey], ...updates }
          }
        };
      }
      return t;
    }));
  };

  const updateTrackPan = (trackId, panValue) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, pan: panValue } : t));
  };

  // Mixed Output State
  const [processedAudioUrl, setProcessedAudioUrl] = useState(null);
  
  // Analysis & Explanation state
  const [sections, setSections] = useState([]);
  const [globalSummary, setGlobalSummary] = useState(null);
  const [explanations, setExplanations] = useState([]);
  const [simpleExplanations, setSimpleExplanations] = useState([]);
  const [automationData, setAutomationData] = useState({}); // Stores AI gain curves per track

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState(null);

  // Shared player ref for seek synchronization
  const playerSeekRef = useRef(null);

  // Helper: Add file to media pool
  const addMediaToPool = (file) => {
    const newMedia = {
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.name.toLowerCase().includes('vocal') ? 'vocal' : 'instrumental'
    };
    setMediaPool(prev => [...prev, newMedia]);
    return newMedia;
  };

  const resetContext = () => {
    setMediaPool([]);
    setTracks(tracks.map(t => ({ ...t, clips: [] })));
    setProcessedAudioUrl(null);
    setSections([]);
    setGlobalSummary(null);
    setExplanations([]);
    setSimpleExplanations([]);
    setAutomationData({});
    setError(null);
    setLoadingStage('');
  };

  /**
   * Advanced Multi-track mix: POST timeline layout and files to /api/mix
   */
  const handleMix = async () => {
    // Check if there are any clips in any track
    const hasClips = tracks.some(t => t.clips.length > 0);
    if (!hasClips) {
      setError("Please add at least one clip to the timeline.");
      return false;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStage('Preparing timeline data...');

    const formData = new FormData();
    const usedMediaIds = new Set();
    
    // Find all media files used in the timeline
    tracks.forEach(t => {
      t.clips.forEach(c => usedMediaIds.add(c.mediaId));
    });

    // Append files, using mediaId as the filename so the backend can map it
    usedMediaIds.forEach(id => {
      const media = mediaPool.find(m => m.id === id);
      if (media) {
        // We set the filename in formData to the mediaId to match it up later
        formData.append('files', media.file, media.id);
      }
    });

    // Append the JSON description of the timeline
    formData.append('timelineState', JSON.stringify({ tracks }));

    try {
      setLoadingStage('Uploading stems & layout...');
      
      const response = await axios.post('http://localhost:5000/api/mix', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percent < 100) {
            setLoadingStage(`Uploading data... ${percent}%`);
          } else {
            setLoadingStage('AI is analyzing and mixing... This may take a moment.');
          }
        },
      });

      const { data } = response;

      setLoadingStage('Rendering results...');

      if (data.processed_audio_base64) {
        setProcessedAudioUrl(data.processed_audio_base64);
      }
      if (data.sections) setSections(data.sections);
      if (data.globalSummary) {
        setGlobalSummary(data.globalSummary);
        if (data.globalSummary.dspSettings) {
          setTracks(prev => prev.map(t => {
            if (t.type === 'vocal') {
              return {
                ...t,
                effects: {
                  ...t.effects,
                  reverb: { 
                    ...t.effects?.reverb, 
                    enabled: data.globalSummary.dspSettings.reverbMix > 0, 
                    mix: Math.round(data.globalSummary.dspSettings.reverbMix * 100) 
                  },
                  delay: { 
                    ...t.effects?.delay, 
                    enabled: data.globalSummary.dspSettings.delayMix > 0, 
                    mix: Math.round(data.globalSummary.dspSettings.delayMix * 100) 
                  }
                }
              };
            }
            return t;
          }));
        }
      }
      if (data.explanations) setExplanations(data.explanations);
      if (data.simpleExplanations) setSimpleExplanations(data.simpleExplanations);
      if (data.automationData) setAutomationData(data.automationData);

      return true;
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred during mixing.');
      return false;
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  /**
   * 1-Click Auto Mix: POST vocal and instrumental directly to /api/automix
   */
  const handleAutoMix = async (vocalFile, instFile, applyPitch) => {
    setIsLoading(true);
    setError(null);
    setLoadingStage('Uploading files for Auto Mix...');

    const formData = new FormData();
    formData.append('files', vocalFile, vocalFile.name);
    formData.append('files', instFile, instFile.name);
    formData.append('applyPitch', applyPitch ? 'true' : 'false');

    try {
      const response = await axios.post('http://localhost:5000/api/automix', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percent < 100) {
            setLoadingStage(`Uploading data... ${percent}%`);
          } else {
            setLoadingStage('AI is calculating alignment and mixing... This may take a moment.');
          }
        },
      });

      const { data } = response;

      setLoadingStage('Rendering results...');

      if (data.processed_audio_base64) {
        setProcessedAudioUrl(data.processed_audio_base64);
      }
      if (data.sections) setSections(data.sections);
      if (data.globalSummary) {
        setGlobalSummary(data.globalSummary);
        if (data.globalSummary.dspSettings) {
          setTracks(prev => prev.map(t => {
            if (t.type === 'vocal') {
              return {
                ...t,
                effects: {
                  ...t.effects,
                  reverb: { 
                    ...t.effects?.reverb, 
                    enabled: data.globalSummary.dspSettings.reverbMix > 0, 
                    mix: Math.round(data.globalSummary.dspSettings.reverbMix * 100) 
                  },
                  delay: { 
                    ...t.effects?.delay, 
                    enabled: data.globalSummary.dspSettings.delayMix > 0, 
                    mix: Math.round(data.globalSummary.dspSettings.delayMix * 100) 
                  }
                }
              };
            }
            return t;
          }));
        }
      }
      if (data.explanations) setExplanations(data.explanations);
      if (data.simpleExplanations) setSimpleExplanations(data.simpleExplanations);
      if (data.automationData) setAutomationData(data.automationData);

      // AutoMix also creates a timeline in the background, but for this quick demo 
      // we'll just show the final result. If we wanted, we could also load the calculated
      // tracks into the DAW state here.
      
      return true;
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred during Auto Mix.');
      return false;
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  const value = {
    eqSettings, setEqSettings,
    
    // DAW State
    mediaPool, setMediaPool, addMediaToPool,
    tracks, setTracks, updateTrackEffect, updateTrackPan,
    masterVolume, setMasterVolume,
    
    // Output
    processedAudioUrl, setProcessedAudioUrl,
    sections, setSections,
    globalSummary, setGlobalSummary,
    explanations, setExplanations,
    simpleExplanations, setSimpleExplanations,
    automationData, setAutomationData,
    
    // Actions
    handleMix,
    handleAutoMix,
    resetContext,
    
    // UI State
    isLoading, setIsLoading,
    loadingStage,
    error, setError,
    playerSeekRef,
  };

  if (!isProjectLoaded) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center text-gray-400 font-mono text-sm tracking-widest uppercase">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          Loading Workspace...
        </div>
      </div>
    );
  }

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudioContext = () => useContext(AudioContext);
