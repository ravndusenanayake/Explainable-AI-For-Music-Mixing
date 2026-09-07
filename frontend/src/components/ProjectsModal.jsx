import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, FolderOpen, Loader2, Trash2, Clock, Music } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAudioContext } from '../context/AudioContext';

const ProjectsModal = ({ isOpen, onClose }) => {
  const { saveProjectToSupabase, loadProjectFromSupabase, isLoading } = useAudioContext();
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeTab, setActiveTab] = useState('load'); // 'load' | 'save'

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      alert('Failed to load projects from Supabase.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSaveNew = async () => {
    if (!newProjectName.trim()) return;
    const success = await saveProjectToSupabase(newProjectName);
    if (success) {
      setNewProjectName('');
      onClose();
    }
  };

  const handleLoad = async (projectId) => {
    const success = await loadProjectFromSupabase(projectId);
    if (success) onClose();
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#161616] border border-[#333] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] bg-[#111]">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-gray-200">Projects (Supabase)</h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-5 pt-4 gap-4 border-b border-[#2a2a2a]">
            <button
              onClick={() => setActiveTab('load')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
                activeTab === 'load' ? 'text-cyan-400 border-cyan-500' : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              Load Project
            </button>
            <button
              onClick={() => setActiveTab('save')}
              className={`pb-2 text-xs font-bold transition-colors border-b-2 ${
                activeTab === 'save' ? 'text-cyan-400 border-cyan-500' : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              Save As New
            </button>
          </div>

          {/* Content */}
          <div className="p-5 flex-1 overflow-y-auto">
            {activeTab === 'save' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., My Awesome Mix v2"
                    className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <button
                  onClick={handleSaveNew}
                  disabled={!newProjectName.trim() || isLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isLoading ? 'Saving to Cloud...' : 'Save Project'}
                </button>
                <p className="text-[10px] text-gray-500 text-center mt-2">
                  This will upload your audio files to Supabase Storage and save track settings to the Database.
                </p>
              </div>
            )}

            {activeTab === 'load' && (
              <div className="space-y-3">
                {loadingProjects ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mb-2" />
                    <span className="text-xs text-gray-500">Fetching projects...</span>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No projects found.</p>
                  </div>
                ) : (
                  projects.map(project => (
                    <div key={project.id} className="group flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#333] rounded-lg hover:border-cyan-500/50 transition-colors">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoad(project.id)}>
                        <h3 className="text-sm font-bold text-gray-200 truncate">{project.name}</h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleLoad(project.id)}
                          disabled={isLoading}
                          className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {isLoading ? 'Loading...' : 'Load'}
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProjectsModal;
