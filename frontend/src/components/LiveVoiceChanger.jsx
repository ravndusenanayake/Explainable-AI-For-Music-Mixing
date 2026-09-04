import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Settings } from 'lucide-react';
import { startMic, stopMic, changeStyle } from '../utils/audioEffects';

const LiveVoiceChanger = () => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('normal');

  const styles = [
    { id: 'normal', name: 'Normal Voice' },
    { id: 'rock', name: 'Rock Singer (Distortion)' },
    { id: 'robot', name: 'Robot Effect' },
    { id: 'telephone', name: 'Telephone Filter' }
  ];

  useEffect(() => {
    // Cleanup mic when component unmounts
    return () => {
      stopMic();
    };
  }, []);

  const handleToggleMic = async () => {
    if (isMicOn) {
      stopMic();
      setIsMicOn(false);
    } else {
      const success = await startMic(selectedStyle);
      if (success) {
        setIsMicOn(true);
      } else {
        alert("Microphone access denied or error occurred.");
      }
    }
  };

  const handleStyleChange = (e) => {
    const newStyle = e.target.value;
    setSelectedStyle(newStyle);
    if (isMicOn) {
      changeStyle(newStyle);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Settings className="w-5 h-5 mr-2 text-blue-400" />
          Live Voice Changer
        </h2>
        <div className="flex space-x-2">
          {isMicOn && (
            <span className="flex items-center text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
              Live
            </span>
          )}
        </div>
      </div>

      <p className="text-gray-400 mb-6 text-sm">
        Speak into your microphone and hear your voice transformed in real-time. Make sure to wear headphones to avoid feedback!
      </p>

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-300 mb-2">Voice Style</label>
          <select 
            value={selectedStyle} 
            onChange={handleStyleChange}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
          >
            {styles.map(style => (
              <option key={style.id} value={style.id}>
                {style.name}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleToggleMic}
          className={`px-6 py-3 rounded-md font-medium flex items-center justify-center transition-colors w-full md:w-auto ${
            isMicOn 
              ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isMicOn ? (
            <>
              <MicOff className="w-5 h-5 mr-2" /> Stop Mic
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 mr-2" /> Start Mic
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LiveVoiceChanger;
