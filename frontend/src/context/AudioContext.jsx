import React, { createContext, useState, useContext, useRef } from 'react';
import axios from 'axios';

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
    eq: { enabled: false, highPass: 80, presence: 3 },
    deEsser: { enabled: false, amount: 50 },
    compressor: { enabled: false, threshold: -15, ratio: 4 },
    reverb: { enabled: false, type: 'plate', mix: 15 },
    delay: { enabled: false, time: '1/4', mix: 10 },
    saturation: { enabled: false, drive: 20 }
  };

  // Array of timeline tracks: { id, name, type, color, clips: [{ id, mediaId, offset }], effects }
  const [tracks, setTracks] = useState([
    { id: 't1', name: 'Lead Vocal', type: 'vocal', color: 'rose', clips: [], effects: JSON.parse(JSON.stringify(defaultEffects)) },
    { id: 't2', name: 'Backing Vocal', type: 'vocal', color: 'pink', clips: [], effects: JSON.parse(JSON.stringify(defaultEffects)) },
    { id: 't3', name: 'Main Instrumental', type: 'instrumental', color: 'cyan', clips: [], effects: JSON.parse(JSON.stringify(defaultEffects)) },
    { id: 't4', name: 'Drums / Beat', type: 'instrumental', color: 'blue', clips: [], effects: JSON.parse(JSON.stringify(defaultEffects)) },
  ]);

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

  // Mixed Output State
  const [processedAudioUrl, setProcessedAudioUrl] = useState(null);
  
  // Analysis & Explanation state
  const [sections, setSections] = useState([]);
  const [globalSummary, setGlobalSummary] = useState(null);
  const [explanations, setExplanations] = useState([]);
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
      if (data.globalSummary) setGlobalSummary(data.globalSummary);
      if (data.explanations) setExplanations(data.explanations);
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

  const value = {
    eqSettings, setEqSettings,
    
    // DAW State
    mediaPool, setMediaPool, addMediaToPool,
    tracks, setTracks, updateTrackEffect,
    
    // Output
    processedAudioUrl, setProcessedAudioUrl,
    sections, setSections,
    globalSummary, setGlobalSummary,
    explanations, setExplanations,
    automationData, setAutomationData,
    
    // Actions
    handleMix,
    resetContext,
    
    // UI State
    isLoading, setIsLoading,
    loadingStage,
    error, setError,
    playerSeekRef,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudioContext = () => useContext(AudioContext);
