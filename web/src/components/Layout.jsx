import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, Server, Shield, Globe, Terminal, Settings } from 'lucide-react';
import { useHost } from '../contexts/HostContext';
import ConnectAgentModal from './ConnectAgentModal';

const SidebarItem = ({ icon: Icon, label, to }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `
            flex items-center gap-3 p-3 mb-2 rounded-lg cursor-pointer transition-all duration-300
            ${isActive
                ? 'bg-cyber-cyan/10 text-cyber-cyan border-l-2 border-cyber-cyan shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                : 'text-gray-400 hover:text-white hover:bg-cyber-gray'}
        `}
    >
        <Icon size={20} />
        <span className="font-mono text-sm tracking-wider">{label}</span>
    </NavLink>
);

const Layout = () => {
    const { selectedHost, setSelectedHost, hosts } = useHost();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    return (
        <div className="flex h-screen bg-cyber-black text-white selection:bg-cyber-cyan/30">
            {/* Sidebar */}
            <aside className="w-64 border-r border-cyber-gray bg-cyber-dark/50 backdrop-blur-xl p-4 flex flex-col">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyber-cyan to-cyber-magenta flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.5)]">
                        <Activity className="text-black" size={20} />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        DATAVAST
                    </h1>
                </div>

                <nav className="flex-1">
                    <SidebarItem icon={Activity} label="DASHBOARD" to="/" />
                    <SidebarItem icon={Terminal} label="LOGS" to="/logs" />
                    <SidebarItem icon={Server} label="INFRASTRUCTURE" to="/infrastructure" />
                    <SidebarItem icon={Globe} label="NETWORK" to="/network" />
                    <SidebarItem icon={Shield} label="SECURITY" to="/security" />
                </nav>

                <div className="mt-auto pt-4 border-t border-cyber-gray">
                    <SidebarItem icon={Settings} label="SETTINGS" to="/settings" />
                    <div className="px-2 mt-4">
                        <div className="text-xs text-cyber-cyan/60 font-mono">
                            STATUS: ONLINE<br />
                            V.1.0.0-ALPHA
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

                {/* Header HUD */}
                <header className="h-16 border-b border-cyber-gray flex items-center justify-between px-6 bg-cyber-black/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-4">
                        <span className="text-cyber-green font-mono text-xs animate-pulse">● SYSTEM STABLE</span>

                        {/* Host Selector */}
                        <div className="flex items-center gap-2 ml-4 border-l border-gray-700 pl-4">
                            <span className="text-xs text-gray-500 font-mono uppercase">Target Node:</span>
                            <select
                                value={selectedHost}
                                onChange={(e) => setSelectedHost(e.target.value)}
                                className="bg-black/50 border border-cyber-cyan/30 rounded px-2 py-1 text-xs font-mono text-cyber-cyan focus:outline-none focus:border-cyber-cyan"
                            >
                                <option value="">SELECT SOURCE...</option>
                                {hosts.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-1.5 border border-cyber-cyan/30 text-cyber-cyan font-mono text-xs hover:bg-cyber-cyan/10 transition-colors uppercase rounded"
                        >
                            Add Data Source
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6 z-10 custom-scrollbar">
                    <Outlet />
                </div>
            </main>

            <ConnectAgentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

export default Layout;
