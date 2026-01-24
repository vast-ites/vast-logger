import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import ConnectAgentModal from './ConnectAgentModal';

const Layout = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="flex h-screen bg-black text-white selection:bg-cyan-500/30 font-sans">
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                <div
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                    }}
                ></div>

                {/* Ambient Glows */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-500/10 blur-[100px] rounded-full pointer-events-none"></div>

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
