import React, { createContext, useContext, useState, useEffect } from 'react';

const HostContext = createContext();

export const HostProvider = ({ children }) => {
    // Initialize from localStorage or default to empty
    const [selectedHost, setSelectedHost] = useState(() => {
        return localStorage.getItem('datavast_selected_host') || '';
    });
    const [hosts, setHosts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Update localStorage when state changes
    useEffect(() => {
        if (selectedHost) {
            localStorage.setItem('datavast_selected_host', selectedHost);
        }
    }, [selectedHost]);

    const fetchHosts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/hosts');
            if (res.ok) {
                const data = await res.json();
                setHosts(data);
            }
        } catch (err) {
            console.error("Failed to fetch hosts", err);
        } finally {
            setLoading(false);
        }
    };

    // Initial Auto-Select Logic
    useEffect(() => {
        if (hosts.length > 0 && !selectedHost) {
            const defaultHost = hosts.includes('fusionpbx') ? 'fusionpbx' : hosts[0];
            setSelectedHost(defaultHost);
        }
    }, [hosts, selectedHost]);

    useEffect(() => {
        fetchHosts();
        const interval = setInterval(fetchHosts, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <HostContext.Provider value={{ selectedHost, setSelectedHost, hosts, loading, refreshHosts: fetchHosts }}>
            {children}
        </HostContext.Provider>
    );
};

export const useHost = () => useContext(HostContext);
