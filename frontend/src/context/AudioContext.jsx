import React, { createContext, useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { get, set } from 'idb-keyval';
import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

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

  const removeMediaFromPool = (id) => {
    setMediaPool(prev => prev.filter(media => media.id !== id));
    setTracks(prevTracks => prevTracks.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.mediaId !== id)
    })));
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

  const dbToGain = (db) => {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
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
        
        // Calculate average AI gain adjustments across all sections
        let avgVocDb = 0;
        let avgInstDb = 0;
        if (data.sections && data.sections.length > 0) {
          let totalVocDb = 0;
          let totalInstDb = 0;
          data.sections.forEach(s => {
            totalVocDb += (s.mixing?.vocalGainDb || 0);
            totalInstDb += (s.mixing?.instrumentalGainDb || 0);
          });
          avgVocDb = totalVocDb / data.sections.length;
          avgInstDb = totalInstDb / data.sections.length;
        }

        const newVocGain = dbToGain(avgVocDb);
        const newInstGain = dbToGain(avgInstDb);

        if (data.globalSummary.dspSettings) {
          setTracks(prev => prev.map(t => {
            if (t.type === 'vocal') {
              return {
                ...t,
                volume: newVocGain, // Auto-apply Vocal Volume
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
            // Auto-apply Instrumental Volume
            if (t.type === 'instrumental' || t.name.toLowerCase().includes('drum') || t.name.toLowerCase().includes('beat')) {
              return { ...t, volume: newInstGain };
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

  /**
   * Send a file to the backend to be converted to a different voice style.
   */
  const handleVoiceConversion = async (mediaId, style) => {
    const media = mediaPool.find(m => m.id === mediaId);
    if (!media) return false;

    setIsLoading(true);
    setError(null);
    setLoadingStage(`Converting voice to ${style} style...`);

    const formData = new FormData();
    formData.append('file', media.file, media.name);
    formData.append('style', style);

    try {
      const response = await axios.post('http://localhost:5000/api/convert-voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data && response.data.processed_audio_base64) {
        // Convert base64 back to a File
        const res = await fetch(response.data.processed_audio_base64);
        const blob = await res.blob();
        
        const styleLabel = style.charAt(0).toUpperCase() + style.slice(1);
        // Clean up the extension if present to avoid .wav (Rock).wav
        const baseName = media.name.replace(/\.[^/.]+$/, "");
        const newFileName = `${baseName} (${styleLabel} Voice).wav`;
        
        const newFile = new File([blob], newFileName, { type: 'audio/wav' });
        
        // Add it to the pool
        addMediaToPool(newFile);
        
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      setError('Failed to convert voice style. Check if backend is running.');
      return false;
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  const value = {
    eqSettings, setEqSettings,
    
    // DAW State
    mediaPool, setMediaPool, addMediaToPool, removeMediaFromPool,
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
    handleVoiceConversion,
    resetContext,
    
    // UI State
    isLoading, setIsLoading,
    loadingStage,
    error, setError,
    playerSeekRef,
  };

  // ==========================================
  // NEW: Pitch Correction (VariAudio)
  // ==========================================
  const handlePitchCorrection = async (mediaId, options = {}) => {
    const media = mediaPool.find(m => m.id === mediaId);
    if (!media) return null;

    setIsLoading(true);
    setError(null);
    setLoadingStage(options.analyzeOnly ? 'Analyzing pitch...' : 'Applying pitch correction...');

    const formData = new FormData();
    formData.append('file', media.file, media.name);
    formData.append('snapStrength', options.snapStrength || 50);
    formData.append('timingStrength', options.timingStrength || 0);
    formData.append('formantPreserve', options.formantPreserve !== false ? 'true' : 'false');
    formData.append('analyzeOnly', options.analyzeOnly ? 'true' : 'false');

    try {
      const response = await axios.post('http://localhost:5000/api/pitch-correct', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percent < 100) {
            setLoadingStage(`Uploading... ${percent}%`);
          } else {
            setLoadingStage(options.analyzeOnly ? 'Detecting pitch...' : 'Correcting pitch & timing...');
          }
        },
      });

      const { data } = response;

      if (!options.analyzeOnly && data.processed_audio_base64) {
        // Create a new media pool entry with the corrected audio
        const res = await fetch(data.processed_audio_base64);
        const blob = await res.blob();
        const baseName = media.name.replace(/\.[^/.]+$/, "");
        const newFileName = `${baseName} (Pitch Corrected).wav`;
        const newFile = new File([blob], newFileName, { type: 'audio/wav' });
        addMediaToPool(newFile);
      }

      return data;
    } catch (err) {
      console.error(err);
      setError('Pitch correction failed: ' + (err.response?.data?.error || err.message));
      return null;
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // ==========================================
  // NEW: Audio Alignment
  // ==========================================
  const handleAlignment = async (referenceTrackId, targetTrackIds) => {
    const refTrack = tracks.find(t => t.id === referenceTrackId);
    if (!refTrack || refTrack.clips.length === 0) {
      setError('Reference track has no clips.');
      return null;
    }

    const targetTracks = tracks.filter(t => targetTrackIds.includes(t.id) && t.clips.length > 0);
    if (targetTracks.length === 0) {
      setError('No target tracks with clips selected.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStage('Aligning tracks...');

    const formData = new FormData();
    
    // Add reference track's first clip
    const refMedia = mediaPool.find(m => m.id === refTrack.clips[0].mediaId);
    if (!refMedia) { setError('Reference clip not found.'); setIsLoading(false); return null; }
    formData.append('files', refMedia.file, refMedia.name);
    formData.append('referenceIndex', '0');

    // Add target tracks' first clips
    for (const track of targetTracks) {
      const media = mediaPool.find(m => m.id === track.clips[0].mediaId);
      if (media) {
        formData.append('files', media.file, media.name);
      }
    }

    try {
      const response = await axios.post('http://localhost:5000/api/align', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const { data } = response;

      if (data.success && data.alignments) {
        // Apply alignment offsets to track clips
        setTracks(prev => prev.map(track => {
          const alignIdx = targetTracks.findIndex(t => t.id === track.id);
          if (alignIdx >= 0 && data.alignments[alignIdx]) {
            const delaySeconds = data.alignments[alignIdx].global_delay_seconds || 0;
            return {
              ...track,
              clips: track.clips.map(clip => ({
                ...clip,
                offset: clip.offset + delaySeconds
              }))
            };
          }
          return track;
        }));
      }

      return data;
    } catch (err) {
      console.error(err);
      setError('Alignment failed: ' + (err.response?.data?.error || err.message));
      return null;
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // ==========================================
  // NEW: Channel Strip Presets
  // ==========================================
  const channelStripPresets = {
    'Clean Vocal': {
      eq: { enabled: true, bands: [
        { id: 1, type: 'highpass', freq: 80, gain: 0, q: 1 },
        { id: 2, type: 'peaking', freq: 3000, gain: 2, q: 1.5 },
        { id: 3, type: 'peaking', freq: 800, gain: -1.5, q: 1 },
        { id: 4, type: 'highshelf', freq: 12000, gain: 1.5, q: 1 }
      ]},
      deEsser: { enabled: true, amount: 40 },
      compressor: { enabled: true, threshold: -18, ratio: 3 },
      saturation: { enabled: false, drive: 0 }
    },
    'Rock Vocal': {
      eq: { enabled: true, bands: [
        { id: 1, type: 'highpass', freq: 120, gain: 0, q: 1 },
        { id: 2, type: 'peaking', freq: 2500, gain: 3, q: 1.2 },
        { id: 3, type: 'peaking', freq: 500, gain: -2, q: 1 },
        { id: 4, type: 'highshelf', freq: 8000, gain: 2, q: 1 }
      ]},
      deEsser: { enabled: true, amount: 50 },
      compressor: { enabled: true, threshold: -15, ratio: 5 },
      saturation: { enabled: true, drive: 25 }
    },
    'Warm Vocal': {
      eq: { enabled: true, bands: [
        { id: 1, type: 'highpass', freq: 60, gain: 0, q: 1 },
        { id: 2, type: 'peaking', freq: 200, gain: 2, q: 0.8 },
        { id: 3, type: 'peaking', freq: 4000, gain: -1, q: 1 },
        { id: 4, type: 'highshelf', freq: 10000, gain: -2, q: 1 }
      ]},
      deEsser: { enabled: true, amount: 60 },
      compressor: { enabled: true, threshold: -20, ratio: 3 },
      saturation: { enabled: true, drive: 15 }
    },
    'Bright Pop': {
      eq: { enabled: true, bands: [
        { id: 1, type: 'highpass', freq: 100, gain: 0, q: 1 },
        { id: 2, type: 'peaking', freq: 5000, gain: 3, q: 1 },
        { id: 3, type: 'peaking', freq: 250, gain: -2, q: 1 },
        { id: 4, type: 'highshelf', freq: 14000, gain: 3, q: 1 }
      ]},
      deEsser: { enabled: true, amount: 55 },
      compressor: { enabled: true, threshold: -16, ratio: 4 },
      saturation: { enabled: false, drive: 0 }
    }
  };

  const applyChannelStripPreset = (trackId, presetName) => {
    const preset = channelStripPresets[presetName];
    if (!preset) return;
    
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          effects: {
            ...t.effects,
            eq: structuredClone(preset.eq),
            deEsser: structuredClone(preset.deEsser),
            compressor: structuredClone(preset.compressor),
            saturation: structuredClone(preset.saturation)
          }
        };
      }
      return t;
    }));
  };

  // ==========================================
  // SUPABASE CLOUD SAVE / LOAD
  // ==========================================

  const saveProjectToSupabase = async (projectName) => {
    setIsLoading(true);
    setLoadingStage('Saving to Cloud...');
    try {
      // 1. Create Project Entry
      const { data: projectData, error: projError } = await supabase
        .from('projects')
        .insert([{ name: projectName }])
        .select()
        .single();
      
      if (projError) throw projError;
      const projectId = projectData.id;

      // 2. Upload Audio Files & Save Tracks
      for (const track of tracks) {
        // Save Track
        const { data: trackData, error: trackError } = await supabase
          .from('tracks')
          .insert([{
            project_id: projectId,
            name: track.name,
            type: track.type,
            color: track.color,
            volume: track.volume,
            pan: track.pan,
            muted: track.isMuted,
            soloed: track.isSoloed,
            effects: track.effects
          }])
          .select()
          .single();

        if (trackError) throw trackError;

        // Save Clips for this track
        for (const clip of track.clips) {
          // If the file is a Blob/File from local upload, upload it to Supabase Storage
          let mediaUrl = clip.url;
          if (clip.file) {
            const fileName = `${projectId}/${trackData.id}/${uuidv4()}.wav`;
            const { error: uploadError } = await supabase.storage
              .from('audio-uploads')
              .upload(fileName, clip.file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
              .from('audio-uploads')
              .getPublicUrl(fileName);
            
            mediaUrl = publicUrlData.publicUrl;
          }

          // Insert Clip Record
          const { error: clipError } = await supabase
            .from('clips')
            .insert([{
              track_id: trackData.id,
              media_url: mediaUrl,
              start_time: clip.startTime || 0,
              duration: clip.duration || 0,
              offset_time: clip.offset || 0,
              trim_start: clip.trimStart || 0,
              trim_end: clip.trimEnd || 0
            }]);

          if (clipError) throw clipError;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Supabase Save Error:', error);
      alert('Failed to save project to Supabase: ' + error.message);
      return false;
    } finally {
      setIsLoading(false);
      setLoadingStage(null);
    }
  };

  const loadProjectFromSupabase = async (projectId) => {
    setIsLoading(true);
    setLoadingStage('Downloading Project Data...');
    try {
      // 1. Fetch Tracks
      const { data: tracksData, error: tracksError } = await supabase
        .from('tracks')
        .select('*')
        .eq('project_id', projectId);
      
      if (tracksError) throw tracksError;

      // 2. Build the DAW state
      const loadedTracks = [];
      const loadedMediaPool = [];

      for (const t of tracksData) {
        // Fetch Clips for track
        const { data: clipsData, error: clipsError } = await supabase
          .from('clips')
          .select('*')
          .eq('track_id', t.id);

        if (clipsError) throw clipsError;

        const trackClips = [];
        for (const c of clipsData) {
          // Download the audio file to create a blob for the UI (WaveSurfer needs it)
          setLoadingStage(`Downloading audio for ${t.name}...`);
          const response = await fetch(c.media_url);
          const blob = await response.blob();
          
          const mediaId = `media_${uuidv4()}`;
          loadedMediaPool.push({
            id: mediaId,
            file: blob,
            url: URL.createObjectURL(blob),
            name: `${t.name} Clip`,
            type: t.type
          });

          trackClips.push({
            id: `clip_${uuidv4()}`,
            mediaId: mediaId,
            file: blob,
            url: URL.createObjectURL(blob),
            startTime: c.start_time,
            duration: c.duration,
            offset: c.offset_time,
            trimStart: c.trim_start,
            trimEnd: c.trim_end
          });
        }

        loadedTracks.push({
          id: `t_${t.id}`,
          name: t.name,
          type: t.type,
          color: t.color,
          volume: t.volume,
          pan: t.pan,
          isMuted: t.muted,
          isSoloed: t.soloed,
          effects: t.effects || structuredClone(defaultEffects),
          clips: trackClips
        });
      }

      setMediaPool(loadedMediaPool);
      setTracks(loadedTracks);
      return true;
    } catch (error) {
      console.error('Supabase Load Error:', error);
      alert('Failed to load project from Supabase: ' + error.message);
      return false;
    } finally {
      setIsLoading(false);
      setLoadingStage(null);
    }
  };

  // ==========================================
  // NEW: AI Stem Splitter
  // ==========================================
  const handleStemSplit = async (mediaId) => {
    const media = mediaPool.find(m => m.id === mediaId);
    if (!media) return null;

    setIsLoading(true);
    setError(null);
    setLoadingStage('Splitting stems with AI...');

    const formData = new FormData();
    formData.append('file', media.file, media.name);

    try {
      const response = await axios.post('http://localhost:5000/api/split-stems', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percent < 100) {
            setLoadingStage(`Uploading for stem split... ${percent}%`);
          } else {
            setLoadingStage('AI is separating stems... This may take a moment.');
          }
        },
      });

      const { data } = response;

      if (data.success && data.stems) {
        // Convert each stem base64 to File and add to media pool
        for (const [stemName, base64Url] of Object.entries(data.stems)) {
          const res = await fetch(base64Url);
          const blob = await res.blob();
          const baseName = media.name.replace(/\.[^/.]+$/, "");
          const newFileName = `${baseName} (${stemName}).wav`;
          const newFile = new File([blob], newFileName, { type: 'audio/wav' });
          addMediaToPool(newFile);
        }
      }

      return data;
    } catch (err) {
      console.error(err);
      setError('Stem split failed: ' + (err.response?.data?.error || err.message));
      return null;
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  value.handlePitchCorrection = handlePitchCorrection;
  value.handleAlignment = handleAlignment;
  value.channelStripPresets = channelStripPresets;
  value.applyChannelStripPreset = applyChannelStripPreset;
  value.saveProjectToSupabase = saveProjectToSupabase;
  value.loadProjectFromSupabase = loadProjectFromSupabase;
  value.handleStemSplit = handleStemSplit;

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
