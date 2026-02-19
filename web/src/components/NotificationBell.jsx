import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, Check, CheckCheck, Trash2, Settings, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * NotificationBell — TopBar dropdown for browser notifications.
 * Shows unread badge, notification feed, and permission controls.
 */
const NotificationBell = () => {
    const {
        permission,
        isEnabled,
        notifications,
        unreadCount,
        requestPermission,
        toggleNotifications,
        markAsRead,
        markAllAsRead,
        clearAll,
    } = useNotifications();

    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatTime = (ts) => {
        const d = new Date(ts);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        return d.toLocaleDateString();
    };

    const getSeverityStyle = (severity) => {
        switch (severity) {
            case 'critical': return 'border-l-red-500 bg-red-500/5';
            case 'warning': return 'border-l-amber-500 bg-amber-500/5';
            case 'info': return 'border-l-cyan-500 bg-cyan-500/5';
            default: return 'border-l-cyber-gray bg-cyber-gray/5';
        }
    };

    const getSeverityBadge = (severity) => {
        switch (severity) {
            case 'critical': return <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-400 uppercase tracking-wider">Critical</span>;
            case 'warning': return <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400 uppercase tracking-wider">Warning</span>;
            default: return <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/20 text-cyan-400 uppercase tracking-wider">Info</span>;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    setShowSettings(false);
                }}
                className="relative p-2 rounded-lg hover:bg-cyber-gray/20 transition-colors text-cyber-muted hover:text-cyber-text"
                title="Notifications"
                id="notification-bell-btn"
            >
                {unreadCount > 0 ? (
                    <BellRing size={20} className="text-cyber-cyan animate-pulse" />
                ) : (
                    <Bell size={20} />
                )}

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-lg shadow-red-500/30 animate-bounce">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] glass-panel rounded-xl border border-cyber-gray/30 shadow-2xl shadow-black/50 z-50 flex flex-col overflow-hidden animate-fade-in-up">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-cyber-gray/20 flex items-center justify-between bg-cyber-dark/80">
                        <div className="flex items-center gap-2">
                            <BellRing size={16} className="text-cyber-cyan" />
                            <span className="text-sm font-bold text-cyber-text tracking-wider font-display">
                                NOTIFICATIONS
                            </span>
                            {unreadCount > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold text-cyber-cyan bg-cyber-cyan/10 rounded">
                                    {unreadCount} NEW
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-1.5 rounded hover:bg-cyber-gray/20 text-cyber-muted hover:text-cyber-text transition-colors"
                                title="Notification Settings"
                            >
                                <Settings size={14} />
                            </button>
                            {notifications.length > 0 && (
                                <>
                                    <button
                                        onClick={markAllAsRead}
                                        className="p-1.5 rounded hover:bg-cyber-gray/20 text-cyber-muted hover:text-cyber-text transition-colors"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck size={14} />
                                    </button>
                                    <button
                                        onClick={clearAll}
                                        className="p-1.5 rounded hover:bg-cyber-gray/20 text-cyber-muted hover:text-red-400 transition-colors"
                                        title="Clear all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="px-4 py-3 border-b border-cyber-gray/20 bg-cyber-gray/10 space-y-3">
                            {/* Enable/Disable */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm text-cyber-text font-semibold block">Browser Notifications</span>
                                    <span className="text-xs text-cyber-muted">Get alerts in your browser when triggered</span>
                                </div>
                                <div
                                    onClick={() => toggleNotifications(!isEnabled)}
                                    className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors ${isEnabled ? 'bg-cyber-green' : 'bg-cyber-gray/40'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${isEnabled ? 'translate-x-5' : ''}`} />
                                </div>
                            </div>

                            {/* Permission Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-cyber-muted">Permission Status</span>
                                {permission === 'granted' ? (
                                    <span className="text-xs text-green-400 font-mono">✓ GRANTED</span>
                                ) : permission === 'denied' ? (
                                    <span className="text-xs text-red-400 font-mono">✗ BLOCKED</span>
                                ) : (
                                    <button
                                        onClick={requestPermission}
                                        className="text-xs text-cyber-cyan hover:text-white transition-colors font-mono"
                                    >
                                        REQUEST ACCESS
                                    </button>
                                )}
                            </div>

                            {permission === 'denied' && (
                                <p className="text-xs text-red-400/80">
                                    Notifications are blocked. Enable them in your browser's site settings.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Notification List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-cyber-muted">
                                <Bell size={32} className="mb-3 opacity-30" />
                                <span className="text-sm font-medium">No notifications</span>
                                <span className="text-xs mt-1 opacity-60">Alerts will appear here when triggered</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-cyber-gray/10">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`px-4 py-3 border-l-2 hover:bg-cyber-gray/10 transition-colors cursor-pointer ${getSeverityStyle(notif.severity)} ${!notif.read ? 'bg-cyber-cyan/5' : ''}`}
                                        onClick={() => markAsRead(notif.id)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {getSeverityBadge(notif.severity)}
                                                    {!notif.read && (
                                                        <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-cyber-text font-medium truncate">
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-cyber-muted mt-0.5 line-clamp-2">
                                                    {notif.message}
                                                </p>
                                                {notif.host && (
                                                    <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-mono bg-cyber-gray/20 text-cyber-muted rounded">
                                                        {notif.host}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-cyber-muted shrink-0 mt-1 font-mono">
                                                {formatTime(notif.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {!isEnabled && permission !== 'denied' && (
                        <div className="px-4 py-2 border-t border-cyber-gray/20 bg-cyber-gray/10">
                            <button
                                onClick={() => {
                                    toggleNotifications(true);
                                    if (permission === 'default') requestPermission();
                                }}
                                className="w-full text-xs text-cyber-cyan hover:text-white transition-colors py-1 font-medium"
                            >
                                Enable Browser Notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
