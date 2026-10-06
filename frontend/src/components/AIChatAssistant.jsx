import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Volume2, Mic } from 'lucide-react';

const AIChatAssistant = ({ globalSummary, explanations, automationData }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSpeak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Your browser does not support Text-to-Speech.');
        }
    };

    const handleListen = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Your browser does not support Speech Recognition. Please try Google Chrome.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US'; // Can be changed or dynamic based on user preference
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev ? prev + ' ' + transcript : transcript);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.content,
                    history: messages,
                    mixContext: { globalSummary, explanations, automationData }
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'model', content: data.reply }]);
            
            // Auto-speak the response to make it feel like a true voice assistant
            handleSpeak(data.reply);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I couldn't reach the AI server right now." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] rounded-lg border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-[#2a2a2a] border-b border-white/5">
                <Bot className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">AI Mix Assistant</h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50 text-cyan-400" />
                        <p className="text-sm">Ask me anything about your mix or audio engineering!</p>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-cyan-600'}`}>
                            {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex flex-col gap-1 max-w-[80%]">
                            <div className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-sm' 
                                : 'bg-[#2a2a2a] text-gray-200 border border-white/5 rounded-tl-sm'
                            }`}>
                                {msg.content}
                            </div>
                            {msg.role === 'model' && (
                                <button 
                                    onClick={() => handleSpeak(msg.content)}
                                    className="self-start text-[10px] text-gray-500 hover:text-cyan-400 flex items-center gap-1 transition-colors px-1"
                                    title="Read Aloud"
                                >
                                    <Volume2 className="w-3 h-3" /> Listen
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white animate-pulse" />
                        </div>
                        <div className="bg-[#2a2a2a] text-gray-400 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-[#2a2a2a] border-t border-white/5">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleListen}
                        className={`p-2 rounded-lg transition-colors ${
                            isListening 
                            ? 'bg-rose-500/20 text-rose-500 border border-rose-500/50 animate-pulse' 
                            : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-white/10 hover:border-white/30'
                        }`}
                        title="Speak your message"
                    >
                        <Mic className="w-4 h-4" />
                    </button>
                    <input 
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder={isListening ? "Listening..." : "Ask how to improve the vocals..."}
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        disabled={isListening}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatAssistant;
