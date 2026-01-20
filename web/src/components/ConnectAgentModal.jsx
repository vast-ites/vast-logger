import React, { useState, useEffect } from 'react';
import { X, Copy, Terminal, CheckCircle, Smartphone } from 'lucide-react';

const ConnectAgentModal = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('LOADING...');
    const [copied, setCopied] = useState(false);
    const [hostInput, setHostInput] = useState('my-server-1');

    useEffect(() => {
        if (isOpen) {
            // Fetch Settings to get API Key
            fetch('/api/v1/settings')
                .then(res => res.json())
                .then(data => {
                    if (data && data.system_api_key) {
                        setApiKey(data.system_api_key);
                    }
                })
                .catch(err => console.error("Failed to load API key", err));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const installCommand = `curl -sL ${window.location.origin}/install.sh | sudo bash -s -- --api-key=${apiKey} --host=${hostInput}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(installCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-cyber-dark border border-cyber-cyan/30 rounded-xl w-full max-w-2xl shadow-[0_0_50px_rgba(0,243,255,0.1)] relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyber-cyan to-cyber-magenta" />

                {/* Header */}
                <div className="p-6 border-b border-cyber-gray flex justify-between items-center">
                    <h2 className="text-xl font-bold font-display text-white flex items-center gap-3">
                        <Terminal className="text-cyber-cyan" />
                        Connect New Agent
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-mono">1. NAME YOUR AGENT HOST</label>
                        <input
                            type="text"
                            value={hostInput}
                            onChange={(e) => setHostInput(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                            className="w-full bg-black/40 border border-cyber-gray rounded px-4 py-2 text-white focus:border-cyber-cyan focus:outline-none font-mono"
                            placeholder="e.g. production-db-1"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-mono">2. RUN INSTALL COMMAND</label>
                        <div className="relative group">
                            <pre className="bg-black/60 border border-cyber-gray rounded-lg p-4 text-xs font-mono text-cyber-green overflow-x-auto whitespace-pre-wrap break-all pr-12">
                                {installCommand}
                            </pre>
                            <button
                                onClick={handleCopy}
                                className="absolute right-2 top-2 p-2 bg-gray-800/80 hover:bg-gray-700 rounded text-gray-300 transition-colors"
                            >
                                {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Run this on the Linux server you wish to monitor. Requires <code>root</code> or <code>sudo</code>.
                        </p>
                    </div>

                    <div className="bg-cyber-cyan/5 border border-cyber-cyan/20 rounded-lg p-4 flex items-start gap-3">
                        <Smartphone className="text-cyber-cyan shrink-0 mt-1" size={18} />
                        <div>
                            <h4 className="text-sm font-bold text-cyber-cyan mb-1">Authorization Required</h4>
                            <p className="text-xs text-gray-400">
                                This command includes your **System API Key**. Treat it as a password.
                                The agent will automatically register with the platform upon successful connection.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-cyber-gray bg-black/20 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white font-mono text-sm"
                    >
                        CLOSE
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConnectAgentModal;
