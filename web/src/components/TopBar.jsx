import React from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';
import { useHost } from '../contexts/HostContext';

export const TopBar = ({ onAddSource }) => {
    const { selectedHost, setSelectedHost, hosts } = useHost();

    return (
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-sm z-10">
            {/* Search Bar */}
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-white/5 rounded-lg leading-5 bg-white/5 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-black/40 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 sm:text-sm transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                        placeholder="Search metrics, logs, or server events..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                        <kbd className="inline-flex items-center border border-gray-700 rounded px-2 text-xs font-sans font-medium text-gray-500">⌘K</kbd>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 ml-6">
                {/* Host Selector */}
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5">
                    <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Source</span>
                    <select
                        value={selectedHost}
                        onChange={(e) => setSelectedHost(e.target.value)}
                        className="bg-transparent text-xs font-mono text-cyan-400 focus:outline-none cursor-pointer min-w-[120px]"
                    >
                        <option value="">ALL SYSTEMS</option>
                        {hosts.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>

                {/* Actions */}
                <button
                    onClick={onAddSource}
                    className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded text-xs font-bold tracking-wider hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all shadow-[0_0_10px_rgba(0,243,255,0.1)]"
                >
                    + ADD SOURCE
                </button>

                <div className="w-px h-6 bg-white/10 mx-2"></div>

                <div className="flex items-center gap-4">
                    <button className="text-gray-500 hover:text-white transition-colors relative">
                        <Bell size={18} />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    </button>
                    <button className="text-gray-400 hover:text-white transition-colors">
                        <HelpCircle size={18} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-300">
                        OP
                    </div>
                </div>
            </div>
        </header>
    );
};
