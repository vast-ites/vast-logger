import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Database, Bell, Shield, Moon, Key, Eye, EyeOff, Copy, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

const Settings = () => {
    const [retention, setRetention] = useState(7);
    const [ddosThreshold, setDdosThreshold] = useState(50);
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState("");

    // Auth State
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaSetup, setMfaSetup] = useState(null); // { secret, url }
    const [mfaUrl, setMfaUrl] = useState("");
    const [mfaCode, setMfaCode] = useState("");

    // Load settings on mount
    React.useEffect(() => {
        fetch('/api/v1/settings')
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setRetention(data.retention_days);
                    setDdosThreshold(data.ddos_threshold);
                    setEmailAlerts(data.email_alerts);
                    setApiKey(data.system_api_key);
                    setMfaEnabled(data.mfa_enabled);
                }
            })
            .catch(err => console.error("Failed to load settings:", err));
    }, []);

    const startMfaSetup = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/mfa/setup', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setMfaSetup(data);
        setMfaUrl(data.url);
    };

    const verifyMfa = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/mfa/enable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ code: mfaCode, secret: mfaSetup.secret })
        });
        if (res.ok) {
            setMfaEnabled(true);
            setMfaSetup(null);
            setStatus("MFA Enabled!");
        } else {
            alert("Invalid Code");
        }
    };

    const disableMfa = async () => {
        if (!confirm("Disable MFA? Are you sure?")) return;
        const token = localStorage.getItem('token');
        await fetch('/api/v1/mfa/disable', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setMfaEnabled(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus("Saving...");

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/v1/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    retention_days: parseInt(retention),
                    ddos_threshold: parseFloat(ddosThreshold),
                    email_alerts: emailAlerts
                })
            });

            if (res.ok) {
                setStatus("Saved Successfully!");
                setTimeout(() => setStatus(""), 2000);
            } else if (res.status === 401) {
                setStatus("Session Expired");
                alert("Session expired or invalid. Please login again.");
                window.location.href = '/login';
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
                {/* Agent Enrollment Keys */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2">
                        <Key size={18} /> Agent Enrollment
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-400 block mb-2">System API Key (Global)</label>
                            <div className="flex items-center gap-2">
                                <code className="bg-black/50 border border-gray-600 rounded px-3 py-2 text-white font-mono flex-1 text-sm overflow-hidden">
                                    {showKey ? apiKey : "••••••••••••••••••••••••••••••••"}
                                </code>
                                <button onClick={() => setShowKey(!showKey)} className="p-2 bg-gray-700 rounded hover:bg-gray-600">
                                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <button onClick={() => navigator.clipboard.writeText(apiKey)} className="p-2 bg-gray-700 rounded hover:bg-gray-600">
                                    <Copy size={16} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Use this key to register new agents.
                            </p>
                        </div>
                    </div>
                </div>

                {/* MFA Settings */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <QrCode size={18} /> Two-Factor Auth
                    </h3>

                    {!mfaEnabled && !mfaSetup ? (
                        <button
                            onClick={startMfaSetup}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-mono text-sm"
                        >
                            ENABLE MFA
                        </button>
                    ) : !mfaEnabled && mfaSetup ? (
                        <div className="space-y-4">
                            <div className="bg-white p-2 w-fit rounded">
                                <QRCode value={mfaUrl} size={150} />
                            </div>
                            <p className="text-xs text-gray-400">Scan this code with Google Authenticator</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="123456"
                                    className="bg-black border border-gray-600 rounded px-3 py-2 w-24 text-center font-mono"
                                    value={mfaCode}
                                    onChange={e => setMfaCode(e.target.value)}
                                />
                                <button onClick={verifyMfa} className="bg-green-600 text-white px-3 py-2 rounded text-sm">VERIFY</button>
                                <button onClick={() => setMfaSetup(null)} className="bg-gray-700 text-white px-3 py-2 rounded text-sm">CANCEL</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <span className="text-green-400 font-mono text-sm flex items-center gap-2">
                                <Shield size={16} /> MFA ACTIVE
                            </span>
                            <button onClick={disableMfa} className="text-red-400 text-xs hover:text-red-300 underline">Disable</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Settings;
