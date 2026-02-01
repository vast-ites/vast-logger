import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Server, Database, Globe, Cloud, Box,
    Activity, ArrowRight, Plus
} from 'lucide-react';
import AddServiceModal from '../components/AddServiceModal';
import { useHost } from '../contexts/HostContext';

const Services = () => {
    const { selectedHost } = useHost();
    const [hosts, setHosts] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };

                // fetch hosts
                const hostsRes = await fetch('/api/v1/hosts', { headers });
                if (hostsRes.status === 401) { window.location.href = '/login'; return; }
                const hostsData = await hostsRes.json();

                // fetch services from ALL hosts and build service objects with host info
                const allServices = [];
                for (const host of hostsData) {
                    try {
                        const svcRes = await fetch(`/api/v1/logs/services?host=${host.hostname}`, { headers });
                        const servicesList = await svcRes.json();
                        servicesList.forEach(s => {
                            allServices.push({ name: s, host: host.hostname });
                        });
                    } catch (e) {
                        console.error(`Failed to fetch services for ${host.hostname}`, e);
                    }
                }

                setHosts(hostsData);
                setServices(allServices);
            } catch (err) {
                console.error("Failed to load services data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const categorizeService = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes('mysql') || lower.includes('postgres') || lower.includes('clickhouse') || lower.includes('mongo') || lower.includes('redis') || lower.includes('influx')) return 'Databases';
        if (lower.includes('nginx') || lower.includes('apache') || lower.includes('caddy') || lower.includes('traefik')) return 'Web Servers';
        return 'Other Services';
    };

    const categories = {
        'Web Servers': { icon: Globe, color: 'text-green-400', items: [] },
        'Databases': { icon: Database, color: 'text-yellow-400', items: [] },
        'Other Services': { icon: Box, color: 'text-gray-400', items: [] }
    };

    // Populate categories with discovered services
    // Filter out internal log discovery types
    const internalTypes = ['filesystem_scan', 'process_open_file', 'system_core', 'agent'];

    services.forEach(item => {
        // Skip internal types
        if (internalTypes.includes(item.name)) return;

        // Filter by selected host (if a specific host is selected)
        if (selectedHost && item.host !== selectedHost) return;

        const cat = categorizeService(item.name);
        categories[cat].items.push({
            name: item.name,
            host: item.host,
            type: 'Service',
            status: 'Active',
            lastSeen: new Date().toISOString()
        });
    });

    if (loading) return <div className="p-8 text-cyan-500">Scanning Infrastructure...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Services & Integrations</h1>
                    <p className="text-gray-400">Manage and monitor your infrastructure components.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-bold rounded-lg transition-colors"
                >
                    <Plus size={18} /> Add Service
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(categories).map(([category, { icon: Icon, color, items }]) => (
                    <div key={category} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-lg bg-gray-800 ${color}`}>
                                <Icon size={24} />
                            </div>
                            <h2 className="text-xl font-semibold text-white">{category}</h2>
                            <span className="ml-auto text-sm bg-gray-800 px-2 py-1 rounded text-gray-400">
                                {items.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {items.length === 0 ? (
                                <p className="text-gray-500 italic text-sm py-4">No services detected.</p>
                            ) : (
                                items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => navigate(`/services/${item.name}`)}
                                        className="flex items-center justify-between p-3 rounded-lg bg-black/40 hover:bg-gray-800 border border-transparent hover:border-gray-700 cursor-pointer group transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <div>
                                                <div className="font-medium text-gray-200 group-hover:text-cyan-400 transition-colors">
                                                    {item.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {item.host ? item.host : item.type}
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowRight size={16} className="text-gray-600 group-hover:text-cyan-500 transform group-hover:translate-x-1 transition-all" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <AddServiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

export default Services;
