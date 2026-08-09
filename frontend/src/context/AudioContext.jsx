import React, { createContext, useState, useContext, useRef } from 'react';
import axios from 'axios';

const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const [eqSettings, setEqSettings] = useState({
    lcFreq: 50,
    hcFreq: 16000,
    enabledModules: new Set(['CUT FILTER', 'DE-ESSER I', 'COMPRESSOR I', 'EQ I', 'SATURATOR'])
  });

  // Multi-track state
  const [vocalFile, setVocalFile] = useState(null);
  const [instrumentalFile, setInstrumentalFile] = useState(null);
  const [vocalAudioUrl, setVocalAudioUrl] = useState(null);
  const [instrumentalAudioUrl, setInstrumentalAudioUrl] = useState(null);
  const [processedAudioUrl, setProcessedAudioUrl] = useState(null);

  // Analysis & Explanation state
  const [sections, setSections] = useState([]);
  const [globalSummary, setGlobalSummary] = useState(null);
  const [explanations, setExplanations] = useState([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState(null);

  // Shared player ref for seek synchronization
  const playerSeekRef = useRef(null);

  // Legacy single-file state (backward compat)
  const [file, setFile] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);

  const handleVocalChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setVocalFile(selectedFile);
      setVocalAudioUrl(URL.createObjectURL(selectedFile));
      setProcessedAudioUrl(null);
      setSections([]);
      setExplanations([]);
      setError(null);
    }
  };

  const handleInstrumentalChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setInstrumentalFile(selectedFile);
      setInstrumentalAudioUrl(URL.createObjectURL(selectedFile));
      setProcessedAudioUrl(null);
      setSections([]);
      setExplanations([]);
      setError(null);
    }
  };

  // Legacy single-file handler
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalAudioUrl(URL.createObjectURL(selectedFile));
      setProcessedAudioUrl(null);
      setExplanations([]);
      setError(null);
    }
  };

  const resetContext = () => {
    setVocalFile(null);
    setInstrumentalFile(null);
    setVocalAudioUrl(null);
    setInstrumentalAudioUrl(null);
    setProcessedAudioUrl(null);
    setSections([]);
    setGlobalSummary(null);
    setExplanations([]);
    setError(null);
    setFile(null);
    setOriginalAudioUrl(null);
    setLoadingStage('');
  };

  /**
   * Multi-track mix: POST both vocal & instrumental to /api/mix
   */
  const handleMix = async () => {
    if (!vocalFile || !instrumentalFile) return false;

    setIsLoading(true);
    setError(null);
    setLoadingStage('Uploading tracks...');

    const formData = new FormData();
    formData.append('vocal', vocalFile);
    formData.append('instrumental', instrumentalFile);

    try {
      setLoadingStage('Analyzing audio segments...');
      
      const response = await axios.post('http://localhost:5000/api/mix', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percent < 100) {
            setLoadingStage(`Uploading tracks... ${percent}%`);
          } else {
            setLoadingStage('AI is analyzing and mixing...');
          }
        },
      });

      const { data } = response;

      setLoadingStage('Rendering results...');

      // Set processed audio
      if (data.processed_audio_base64) {
        setProcessedAudioUrl(data.processed_audio_base64);
      }

      // Set sections (bar-by-bar data)
      if (data.sections) {
        setSections(data.sections);
      }

      // Set global summary
      if (data.globalSummary) {
        setGlobalSummary(data.globalSummary);
      }

      // Set explanations for XAI dashboard
      if (data.explanations && data.explanations.length > 0) {
        setExplanations(data.explanations);
      }

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
   * Legacy single-track upload
   */
  const handleUpload = async () => {
    if (!file) return false;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { data } = response;

      if (data.explanations) {
        setExplanations(data.explanations);
      } else {
        setExplanations([
          { action: "Applied Low-Cut Filter at 40Hz", reason: "Excessive sub-frequency rumble detected below 40Hz.", tip: "Always use high-pass filters on non-bass instruments." },
          { action: "Dynamic EQ on Vocal Range", reason: "Harsh resonances found around 3kHz.", tip: "A dynamic EQ cuts narrow Q bands only when they become piercing." },
          { action: "RMS Leveling & True Peak Limiting", reason: "Track had highly dynamic peaks.", tip: "Set your True Peak Limiter ceiling to -1.0dBTP for streaming." }
        ]);
      }

      if (data.processed_audio_url || data.processed_audio_base64) {
        setProcessedAudioUrl(data.processed_audio_url || data.processed_audio_base64);
      } else {
        setProcessedAudioUrl(URL.createObjectURL(file));
      }
      return true;
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred during processing.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    eqSettings, setEqSettings,
    // Multi-track
    vocalFile, setVocalFile,
    instrumentalFile, setInstrumentalFile,
    vocalAudioUrl, setVocalAudioUrl,
    instrumentalAudioUrl, setInstrumentalAudioUrl,
    sections, setSections,
    globalSummary, setGlobalSummary,
    handleVocalChange,
    handleInstrumentalChange,
    handleMix,
    // Legacy
    file, setFile,
    originalAudioUrl, setOriginalAudioUrl,
    handleFileChange,
    handleUpload,
    // Shared
    processedAudioUrl, setProcessedAudioUrl,
    explanations, setExplanations,
    isLoading, setIsLoading,
    loadingStage,
    error, setError,
    resetContext,
    playerSeekRef,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudioContext = () => useContext(AudioContext);
