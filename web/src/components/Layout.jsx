import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import ConnectAgentModal from './ConnectAgentModal';

const Layout = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="flex h-screen font-sans selection:bg-cyan-500/30">
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background Grid — single lightweight element */}
                <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(rgb(var(--cyber-muted) / 0.1) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--cyber-muted) / 0.1) 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                    }}
                ></div>

                {/* Ambient Glows — use radial-gradient instead of blur filter */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(0,243,255,0.06) 0%, transparent 70%)' }}
                ></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }}
                ></div>

                <TopBar onAddSource={() => setIsModalOpen(true)} />

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6 z-10 custom-scrollbar relative">
                    <Outlet />
                </div>
            </main>

            <ConnectAgentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

export default Layout;
