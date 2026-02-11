import React from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';
import { useHost } from '../contexts/HostContext';

export const TopBar = ({ onAddSource }) => {
    const { selectedHost, setSelectedHost, hosts, refreshInterval, setRefreshInterval } = useHost();

    return (
        <header className="h-16 border-b border-cyber-gray/20 flex items-center justify-between px-6 glass-panel rounded-none border-t-0 border-l-0 border-r-0 z-10">
            {/* Search Bar */}
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-cyber-muted group-focus-within:text-cyan-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-cyber-gray/20 rounded-lg leading-5 bg-cyber-gray/10 text-cyber-text placeholder-cyber-muted focus:outline-none focus:bg-cyber-gray/20 focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/50 sm:text-sm transition-all shadow-[0_0_0_1px_rgba(var(--cyber-cyan),0.05)]"
                        placeholder="Search metrics, logs, or server events..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                        <kbd className="inline-flex items-center border border-gray-700 rounded px-2 text-xs font-sans font-medium text-gray-500">⌘K</kbd>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 ml-6">
                {/* Refresh Rate Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">REFRESH:</span>
                    <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        className="bg-transparent text-xs font-mono text-cyan-400 focus:outline-none cursor-pointer border-b border-cyber-gray/20 pb-0.5 hover:border-cyan-500/50 transition-colors"
                    >
                        <option value={1000}>1s (Realtime)</option>
                        <option value={2000}>2s (Fast)</option>
                        <option value={5000}>5s (Normal)</option>
                        <option value={10000}>10s (Slow)</option>
                        <option value={30000}>30s (Eco)</option>
                    </select>
                </div>

                <div className="w-px h-6 bg-cyber-gray/20"></div>

                {/* Host Selector */}
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-cyber-gray/20 bg-cyber-gray/10">
                    <span className="text-[10px] text-cyber-muted font-mono uppercase tracking-wider">Source</span>
                    <select
                        value={selectedHost}
                        onChange={(e) => setSelectedHost(e.target.value)}
                        className="bg-transparent text-xs font-mono text-cyan-400 focus:outline-none cursor-pointer min-w-[120px]"
                    >
                        <option value="">ALL SYSTEMS</option>
                        {hosts.map(h => {
                            const lastSeen = new Date(h.last_seen).getTime();
                            const isOffline = (Date.now() - lastSeen) > 60000;
                            return (
                                <option key={h.hostname} value={h.hostname} className={isOffline ? 'text-red-400' : 'text-cyan-400'}>
                                    {isOffline ? '🔴 ' : '🟢 '}
                                    {h.hostname} {h.ip && h.ip !== 'Unknown' ? `(${h.ip})` : ''}
                                    {isOffline ? ' [OFFLINE]' : ''}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Actions */}
                <button
                    onClick={onAddSource}
                    className="px-3 py-1.5 bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20 rounded text-xs font-bold tracking-wider hover:bg-cyber-cyan/20 hover:border-cyber-cyan/40 transition-all shadow-[0_0_10px_rgba(var(--cyber-cyan),0.1)]"
                >
                    + ADD SOURCE
                </button>

                <div className="w-px h-6 bg-cyber-gray/20 mx-2"></div>

                <div className="flex items-center gap-4">
                    <button className="text-cyber-muted hover:text-cyber-text transition-colors relative">
                        <Bell size={18} />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    </button>
                    <button className="text-cyber-muted hover:text-cyber-text transition-colors">
                        <HelpCircle size={18} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-gray to-cyber-black border border-cyber-gray/20 flex items-center justify-center text-xs font-bold text-cyber-muted">
                        OP
                    </div>
                </div>
            </div>
        </header>
    );
};
