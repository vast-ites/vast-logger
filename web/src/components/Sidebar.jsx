import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, Server, Shield, Globe, Terminal, Settings, Cpu, HardDrive, Zap, CircleDashed, LayoutDashboard, ScrollText, BellRing, Users, LogOut } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const SidebarItem = ({ path, label, icon: Icon }) => (
    <NavLink
        to={path}
        className={({ isActive }) => `
            flex items-center gap-3 p-3 mb-2 rounded-lg cursor-pointer transition-all duration-300
            ${isActive
                ? 'bg-cyber-cyan/10 text-cyber-cyan border-l-2 border-cyber-cyan shadow-[0_0_15px_rgba(var(--cyber-cyan),0.1)]'
                : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-gray/20'}
        `}
    >
        <Icon size={18} />
        <span className="font-mono text-xs font-bold tracking-widest">{label}</span>
    </NavLink>
);

export const Sidebar = () => {
    return (
        <aside className="w-64 border-r border-cyber-gray/20 glass-panel p-4 flex flex-col h-screen sticky top-0 overflow-hidden rounded-none border-l-0 border-t-0 border-b-0">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10 px-2 mt-2">
                <div className="relative group">
                    <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyber-cyan to-violet-500 flex items-center justify-center relative z-10">
                        <Activity className="text-black" size={20} />
                    </div>
                    <div className="absolute inset-0 bg-cyber-cyan blur-lg opacity-50 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-cyber-text tracking-widest font-display">
                        DataVAST
                    </h1>
                    <span className="text-[10px] text-cyber-cyan font-mono tracking-[0.2em] relative -top-1 block">
                        OBSERVABILITY
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="mb-6">
                    <h3 className="text-[10px] text-cyber-muted font-mono uppercase tracking-widest mb-3 pl-3">Overview</h3>
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/" />
                    <SidebarItem icon={Activity} label="Services" path="/services" />
                    <SidebarItem icon={ScrollText} label="Logs" path="/logs" />
                    <SidebarItem icon={Shield} label="IP Intelligence" path="/ip-intelligence" />
                </div>

                <div className="mb-6">
                    <h3 className="text-[10px] text-cyber-muted font-mono uppercase tracking-widest mb-3 pl-3">Infrastructure</h3>
                    <SidebarItem icon={Server} label="Servers" path="/infrastructure" />
                    <SidebarItem icon={Cpu} label="CPU" path="/infrastructure/cpu" />
                    <SidebarItem icon={CircleDashed} label="Memory" path="/infrastructure/memory" />
                    <SidebarItem icon={HardDrive} label="Storage" path="/infrastructure/storage" />
                    <SidebarItem icon={Globe} label="Network" path="/infrastructure/network" />
                </div>

                <div className="mb-6">
                    <h3 className="text-[10px] text-cyber-muted font-mono uppercase tracking-widest mb-3 pl-3">Observability</h3>
                    <SidebarItem icon={Shield} label="Security" path="/security" />
                    <SidebarItem icon={BellRing} label="Alerts" path="/alerts" />
                    <SidebarItem icon={Globe} label="Connection Tracking" path="/connections" />
                    {localStorage.getItem('role') === 'admin' && (
                        <SidebarItem icon={Users} label="Users" path="/users" />
                    )}
                </div>
            </div>

            <div className="pt-4 border-t border-cyber-gray/20">
                <div className="flex items-center justify-between px-2 mb-2">
                    {localStorage.getItem('role') === 'admin' && (
                        <SidebarItem icon={Settings} label="Settings" path="/settings" />
                    )}
                    <ThemeToggle />
                </div>
                <div className="px-3 mt-4">
                    <div className="flex flex-col gap-1 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] text-cyber-muted font-mono uppercase">
                                {localStorage.getItem('username') || 'Unknown User'}
                            </span>
                        </div>
                        <span className="text-[9px] text-cyber-dim font-mono ml-4 uppercase">
                            ROLE: {localStorage.getItem('role') || 'Viewer'}
                        </span>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.href = '/login';
                        }}
                        className="mt-4 w-full flex items-center justify-center gap-2 p-2 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-all text-xs font-bold border border-red-900/30"
                    >
                        <LogOut size={14} /> LOGOUT
                    </button>
                </div>
            </div>
        </aside>
    );
};
