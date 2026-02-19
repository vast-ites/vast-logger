import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ScrollText, Server, BellRing, Settings } from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Home', path: '/' },
    { icon: Server, label: 'Servers', path: '/infrastructure' },
    { icon: ScrollText, label: 'Logs', path: '/logs' },
    { icon: BellRing, label: 'Alerts', path: '/alerts' },
    { icon: Settings, label: 'Settings', path: '/settings' },
];

export const MobileNav = () => {
    const location = useLocation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden mobile-bottom-nav">
            <div className="flex items-center justify-around h-16 px-1">
                {navItems.map(({ icon: Icon, label, path }) => {
                    const isActive = path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(path);

                    return (
                        <NavLink
                            key={path}
                            to={path}
                            className="flex flex-col items-center justify-center flex-1 py-1 mobile-nav-item"
                        >
                            <div className={`
                                flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
                                ${isActive
                                    ? 'bg-cyber-cyan/15 text-cyber-cyan shadow-[0_0_12px_rgba(var(--cyber-cyan),0.3)]'
                                    : 'text-cyber-muted'
                                }
                            `}>
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                            </div>
                            <span className={`
                                text-[9px] font-mono mt-0.5 tracking-wider transition-colors duration-200
                                ${isActive ? 'text-cyber-cyan font-bold' : 'text-cyber-muted'}
                            `}>
                                {label}
                            </span>
                        </NavLink>
                    );
                })}
            </div>

            {/* Safe area spacer for devices with home indicator */}
            <div className="h-safe-bottom" />
        </nav>
    );
};
