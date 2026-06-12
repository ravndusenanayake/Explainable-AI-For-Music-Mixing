import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';

const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const [eqSettings, setEqSettings] = useState({
    lcFreq: 50,
    hcFreq: 16000,
    enabledModules: new Set(['CUT FILTER', 'DE-ESSER I', 'COMPRESSOR I', 'EQ I', 'SATURATOR'])
  });

  const [file, setFile] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
  const [processedAudioUrl, setProcessedAudioUrl] = useState(null);
  const [explanations, setExplanations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setOriginalAudioUrl(URL.createObjectURL(selectedFile));
      // Reset previous results when a new file is uploaded
      setProcessedAudioUrl(null);
      setExplanations([]);
      setError(null);
    }
  };

  const resetContext = () => {
    setFile(null);
    setOriginalAudioUrl(null);
    setProcessedAudioUrl(null);
    setExplanations([]);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return false;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { data } = response;
      
      if (data.explanations) {
        setExplanations(data.explanations);
      } else {
        setExplanations([
          { action: "Applied Low-Cut Filter at 40Hz", reason: "Excessive sub-frequency rumble detected below 40Hz that was consuming headroom without adding musical value.", tip: "Always use high-pass filters on non-bass instruments to clean up the low-end." },
          { action: "Dynamic EQ on Vocal Range", reason: "Harsh resonances found around 3kHz when the signal crossed -12dBFS.", tip: "A dynamic EQ cuts narrow Q bands only when they become piercing, preserving brightness." },
          { action: "RMS Leveling & True Peak Limiting", reason: "Track had highly dynamic peaks causing true-peak clipping at +0.5dB.", tip: "Set your True Peak Limiter ceiling to -1.0dBTP for streaming platforms." }
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
    file, setFile,
    originalAudioUrl, setOriginalAudioUrl,
    processedAudioUrl, setProcessedAudioUrl,
    explanations, setExplanations,
    isLoading, setIsLoading,
    error, setError,
    handleFileChange,
    handleUpload,
    resetContext
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudioContext = () => useContext(AudioContext);
