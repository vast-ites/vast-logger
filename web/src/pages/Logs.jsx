import React, { useState, useEffect } from 'react';
import { Search, Filter, Terminal, AlertTriangle, Bug, Info } from 'lucide-react';

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [filterLevel, setFilterLevel] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterLevel !== 'ALL') params.append('level', filterLevel);
            if (searchTerm) params.append('search', searchTerm);

            const res = await fetch(`http://localhost:8080/api/v1/logs/search?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (err) {
            console.error("Failed to fetch logs", err);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timeout = setTimeout(fetchLogs, 500);
        return () => clearTimeout(timeout);
    }, [filterLevel, searchTerm]);

    const getLevelIcon = (level) => {
        switch (level) {
            case 'ERROR': return <AlertTriangle size={14} className="text-red-500" />;
            case 'WARN': return <AlertTriangle size={14} className="text-cyber-yellow" />;
            case 'DEBUG': return <Bug size={14} className="text-gray-400" />;
            default: return <Info size={14} className="text-cyber-cyan" />;
        }
    };

    const getLevelClass = (level) => {
        switch (level) {
            case 'ERROR': return 'text-red-500 bg-red-500/10 border-red-500/30';
            case 'WARN': return 'text-cyber-yellow bg-cyber-yellow/10 border-cyber-yellow/30';
            case 'DEBUG': return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
            default: return 'text-cyber-cyan bg-cyber-cyan/10 border-cyber-cyan/30';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                    <Terminal className="text-cyber-cyan" />
                    System Log Explorer
                </h1>
                <div className="text-xs font-mono text-gray-500">
                    Live Query Interface
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search logs via regex..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-cyber-gray rounded pl-10 pr-4 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-all"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-500" />
                    <select
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="bg-black/40 border border-cyber-gray rounded px-4 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none appearance-none cursor-pointer hover:bg-cyber-gray/20"
                    >
                        <option value="ALL">All Levels</option>
                        <option value="INFO">INFO</option>
                        <option value="WARN">WARN</option>
                        <option value="ERROR">ERROR</option>
                        <option value="DEBUG">DEBUG</option>
                    </select>
                </div>
            </div>

            {/* Results Table */}
            <div className="glass-panel rounded-xl overflow-hidden min-h-[500px] flex flex-col">
                <div className="bg-cyber-dark/80 px-4 py-3 border-b border-cyber-gray flex justify-between items-center">
                    <span className="text-xs font-mono text-gray-400">{logs.length} EVENTS FOUND</span>
                    {loading && <span className="text-xs font-mono text-cyber-cyan animate-pulse">QUERYING...</span>}
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar bg-black/20">
                    {logs.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                            <Terminal size={40} className="opacity-20" />
                            <p>No logs matching query</p>
                        </div>
                    ) : (
                        <div className="font-mono text-xs">
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-4 p-2 hover:bg-white/5 border-b border-white/5 transition-colors items-start">
                                    <span className="text-gray-500 shrink-0 w-32">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <div className={`shrink-0 w-20 flex items-center justify-center gap-1 px-1 py-0.5 rounded border text-[10px] font-bold ${getLevelClass(log.level)}`}>
                                        {getLevelIcon(log.level)}
                                        {log.level || 'INFO'}
                                    </div>
                                    <span className="text-cyber-magenta shrink-0 w-32 truncate" title={log.host}>
                                        {log.host || 'localhost'}
                                    </span>
                                    <span className="text-cyber-green shrink-0 w-40 truncate" title={log.source_path}>
                                        {log.source_path.split('/').pop()}
                                    </span>
                                    <span className="text-gray-300 break-all">
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Logs;
