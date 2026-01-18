import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Database, Bell, Shield, Moon } from 'lucide-react';

const Settings = () => {
    const [retention, setRetention] = useState(7);
    const [ddosThreshold, setDdosThreshold] = useState(50);
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState("");

    // Load settings on mount
    React.useEffect(() => {
        fetch('http://localhost:8080/api/v1/settings')
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setRetention(data.retention_days);
                    setDdosThreshold(data.ddos_threshold);
                    setEmailAlerts(data.email_alerts);
                }
            })
            .catch(err => console.error("Failed to load settings:", err));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setStatus("Saving...");

        try {
            const res = await fetch('http://localhost:8080/api/v1/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    retention_days: parseInt(retention),
                    ddos_threshold: parseFloat(ddosThreshold),
                    email_alerts: emailAlerts
                })
            });

            if (res.ok) {
                setStatus("Saved Successfully!");
                setTimeout(() => setStatus(""), 2000);
            } else {
                setStatus("Error Saving");
            }
        } catch (err) {
            console.error(err);
            setStatus("Connection Error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                    <SettingsIcon className="text-gray-400" />
                    System Configuration
                </h1>
                <div className="flex items-center gap-4">
                    {status && <span className="text-cyber-cyan font-mono text-sm animate-pulse">{status}</span>}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-cyber-cyan/10 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saving ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data Retention */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-cyber-magenta mb-4 flex items-center gap-2">
                        <Database size={18} /> Data Retention
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-400 block mb-2">Log Retention Period (Days)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1"
                                    max="90"
                                    value={retention}
                                    onChange={(e) => setRetention(e.target.value)}
                                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyber-magenta"
                                />
                                <span className="font-mono text-xl text-white w-12 text-center">{retention}d</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Older logs will be automatically purged from ClickHouse to save space.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Security Thresholds */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-red-500 mb-4 flex items-center gap-2">
                        <Shield size={18} /> Security Thresholds
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-400 block mb-2">DDoS Trigger Limit (MB/s)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    value={ddosThreshold}
                                    onChange={(e) => setDdosThreshold(e.target.value)}
                                    className="bg-black/50 border border-gray-600 rounded px-4 py-2 text-white w-full focus:border-red-500 focus:outline-none"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Network traffic exceeding this rate will trigger CRITICAL alert mode.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-cyber-yellow mb-4 flex items-center gap-2">
                        <Bell size={18} /> Notifications
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-300">Email Alerts</span>
                            <div
                                onClick={() => setEmailAlerts(!emailAlerts)}
                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${emailAlerts ? 'bg-cyber-green' : 'bg-gray-700'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${emailAlerts ? 'translate-x-6' : ''}`} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Receive notifications for Critical Severity logs and DDoS events.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
