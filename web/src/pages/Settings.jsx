import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Database, Bell, Shield, Moon, Key, Eye, EyeOff, Copy } from 'lucide-react';

// import QRCode from 'react-qr-code';

const Settings = () => {
    const [retention, setRetention] = useState(7);
    const [ddosThreshold, setDdosThreshold] = useState(50);
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [alertEmails, setAlertEmails] = useState([]);
    const [webhookURLs, setWebhookURLs] = useState([]);
    const [smtpServer, setSmtpServer] = useState("");
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpUser, setSmtpUser] = useState("");
    const [smtpPassword, setSmtpPassword] = useState("");
    const [showSMTP, setShowSMTP] = useState(false);

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
                    setEmailAlerts(data.email_alerts || false);
                    setAlertEmails(data.alert_emails || []);
                    setWebhookURLs(data.webhook_urls || []);
                    setSmtpServer(data.smtp_server || "");
                    setSmtpPort(data.smtp_port || 587);
                    setSmtpUser(data.smtp_user || "");
                    setSmtpPassword(data.smtp_password || "");

                    setApiKey(data.system_api_key);
                    setMfaEnabled(data.mfa_enabled);
                }
            })
            .catch(err => console.error("Failed to load settings:", err));
    }, []);

    const startMfaSetup = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/v1/mfa/setup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setMfaSetup(data);
                setMfaUrl(data.url);
            } else {
                alert("Failed to setup MFA: " + data.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const verifyMfa = async () => {
        const token = localStorage.getItem('token');
        try {
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
                setMfaCode("");
            } else {
                alert("Invalid Code");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const disableMfa = async () => {
        if (!window.confirm("Are you sure you want to disable MFA?")) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/v1/mfa/disable', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setMfaEnabled(false);
            }
        } catch (err) {
            console.error(err);
        }
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
                    email_alerts: emailAlerts,
                    alert_emails: alertEmails,
                    webhook_urls: webhookURLs,
                    smtp_server: smtpServer,
                    smtp_port: parseInt(smtpPort),
                    smtp_user: smtpUser,
                    smtp_password: smtpPassword
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
                <h1 className="text-2xl font-bold font-display text-cyber-text flex items-center gap-3">
                    <SettingsIcon className="text-cyber-muted" />
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
                            <label className="text-sm text-cyber-muted block mb-2 font-medium">Log Retention Period (Days)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1"
                                    max="90"
                                    value={retention}
                                    onChange={(e) => setRetention(e.target.value)}
                                    className="flex-1 h-2 bg-cyber-gray/30 rounded-lg appearance-none cursor-pointer accent-cyber-magenta"
                                />
                                <span className="font-mono text-xl text-cyber-text w-12 text-center">{retention}d</span>
                            </div>
                            <p className="text-xs text-cyber-muted mt-2">
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
                            <label className="text-sm text-cyber-muted block mb-2">DDoS Trigger Limit (MB/s)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    value={ddosThreshold}
                                    onChange={(e) => setDdosThreshold(e.target.value)}
                                    className="bg-cyber-gray/10 border border-cyber-gray/30 rounded px-4 py-2 text-cyber-text w-full focus:border-red-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <p className="text-xs text-cyber-muted mt-2">
                                Network traffic exceeding this rate will trigger CRITICAL alert mode.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Notifications & Alerting */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray md:col-span-2">
                    <h3 className="text-lg font-bold text-cyber-yellow mb-4 flex items-center gap-2">
                        <Bell size={18} /> Alerting Channels
                    </h3>

                    {/* Master Switch */}
                    <div className="flex items-center justify-between mb-6 p-4 bg-cyber-gray/10 rounded-lg border border-cyber-gray/20">
                        <div>
                            <span className="text-cyber-text font-bold block">Enable Alerting</span>
                            <span className="text-xs text-cyber-muted">Master switch for all notifications (Email & Webhooks)</span>
                        </div>
                        <div
                            onClick={() => setEmailAlerts(!emailAlerts)}
                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${emailAlerts ? 'bg-cyber-green' : 'bg-cyber-gray/40'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${emailAlerts ? 'translate-x-6' : ''}`} />
                        </div>
                    </div>

                    {emailAlerts && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Email Recipients */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-cyber-cyan uppercase tracking-wider">Email Recipients</h4>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            placeholder="admin@example.com"
                                            className="flex-1 bg-cyber-gray/10 border border-cyber-gray/30 rounded px-3 py-2 text-cyber-text text-sm focus:border-cyber-cyan outline-none transition-colors"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = e.target.value.trim();
                                                    if (val && !alertEmails.includes(val)) {
                                                        setAlertEmails([...alertEmails, val]);
                                                        e.target.value = '';
                                                    }
                                                }
                                            }}
                                            id="email-input"
                                        />
                                        <button
                                            onClick={() => {
                                                const el = document.getElementById('email-input');
                                                const val = el.value.trim();
                                                if (val && !alertEmails.includes(val)) {
                                                    setAlertEmails([...alertEmails, val]);
                                                    el.value = '';
                                                }
                                            }}
                                            className="bg-cyber-cyan/20 text-cyber-cyan px-3 py-2 rounded hover:bg-cyber-cyan/30 text-sm"
                                        >
                                            ADD
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {alertEmails.map((email, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-cyber-gray/20 px-3 py-2 rounded text-sm text-cyber-text">
                                                <span>{email}</span>
                                                <button onClick={() => setAlertEmails(alertEmails.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300">×</button>
                                            </div>
                                        ))}
                                        {alertEmails.length === 0 && <p className="text-xs text-cyber-muted italic">No recipients added.</p>}
                                    </div>
                                </div>

                                {/* SMTP Settings */}
                                <div className="mt-6 pt-4 border-t border-cyber-gray/20">
                                    <button
                                        onClick={() => setShowSMTP(!showSMTP)}
                                        className="text-xs text-cyber-muted flex items-center gap-1 hover:text-cyber-text mb-3"
                                    >
                                        Configure SMTP Server {showSMTP ? '▲' : '▼'}
                                    </button>

                                    {showSMTP && (
                                        <div className="space-y-3 bg-cyber-black/30 p-4 rounded border border-cyber-dim">
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="col-span-2">
                                                    <label className="text-xs text-cyber-muted block mb-1">Server Host</label>
                                                    <input value={smtpServer} onChange={e => setSmtpServer(e.target.value)} type="text" placeholder="smtp.gmail.com" className="w-full bg-cyber-gray/20 border border-cyber-dim rounded px-2 py-1 text-sm text-cyber-text" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-cyber-muted block mb-1">Port</label>
                                                    <input value={smtpPort} onChange={e => setSmtpPort(parseInt(e.target.value) || 587)} type="number" className="w-full bg-cyber-gray/20 border border-cyber-dim rounded px-2 py-1 text-sm text-cyber-text" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-cyber-muted block mb-1">Username</label>
                                                    <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} type="text" className="w-full bg-cyber-gray/20 border border-cyber-dim rounded px-2 py-1 text-sm text-cyber-text" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-cyber-muted block mb-1">Password</label>
                                                    <input value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} type="password" className="w-full bg-cyber-gray/20 border border-cyber-dim rounded px-2 py-1 text-sm text-cyber-text" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Webhooks */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Webhook URLs</h4>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="https://discord.com/api/webhooks/..."
                                            className="flex-1 bg-cyber-gray/10 border border-cyber-gray/30 rounded px-3 py-2 text-cyber-text text-sm focus:border-purple-400 outline-none transition-colors"

                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = e.target.value.trim();
                                                    if (val && !webhookURLs.includes(val)) {
                                                        setWebhookURLs([...webhookURLs, val]);
                                                        e.target.value = '';
                                                    }
                                                }
                                            }}
                                            id="webhook-input"
                                        />
                                        <button
                                            onClick={() => {
                                                const el = document.getElementById('webhook-input');
                                                const val = el.value.trim();
                                                if (val && !webhookURLs.includes(val)) {
                                                    setWebhookURLs([...webhookURLs, val]);
                                                    el.value = '';
                                                }
                                            }}
                                            className="bg-purple-500/20 text-purple-400 px-3 py-2 rounded hover:bg-purple-500/30 text-sm"
                                        >
                                            ADD
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {webhookURLs.map((url, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-cyber-gray/20 px-3 py-2 rounded text-sm text-cyber-text break-all">
                                                <span className="truncate mr-2">{url}</span>
                                                <button onClick={() => setWebhookURLs(webhookURLs.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 flex-shrink-0">×</button>
                                            </div>
                                        ))}
                                        {webhookURLs.length === 0 && <p className="text-xs text-cyber-muted italic">No webhooks configured.</p>}
                                    </div>
                                    <p className="text-xs text-cyber-muted mt-2">
                                        Sends JSON payload for Critical events. Compatible with Slack, Discord, Teams.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* Agent Enrollment Keys */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2">
                        <Key size={18} /> Agent Enrollment
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-cyber-muted block mb-2">System API Key (Global)</label>
                            <div className="flex items-center gap-2">
                                <code className="bg-cyber-gray/10 border border-cyber-gray/30 rounded px-3 py-2 text-cyber-text font-mono flex-1 text-sm overflow-hidden">
                                    {showKey ? apiKey : "••••••••••••••••••••••••••••••••"}
                                </code>
                                <button onClick={() => setShowKey(!showKey)} className="p-2 bg-cyber-gray/20 rounded hover:bg-cyber-gray/30 text-cyber-text">
                                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <button onClick={() => navigator.clipboard.writeText(apiKey)} className="p-2 bg-cyber-gray/20 rounded hover:bg-cyber-gray/30 text-cyber-text">
                                    <Copy size={16} />
                                </button>
                            </div>
                            <p className="text-xs text-cyber-muted mt-2">
                                Use this key to register new agents.
                            </p>
                        </div>
                    </div>
                </div>

                {/* MFA Settings */}
                <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
                    <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <Shield size={18} /> Two-Factor Auth
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
                                {/* QRCode temporarily disabled for stability check */}
                                {/* <QRCode value={mfaUrl} size={150} /> */}
                                <div className="w-[150px] h-[150px] bg-gray-200 flex items-center justify-center text-black text-xs text-center">
                                    QR Code Placeholder
                                </div>
                            </div>
                            <p className="text-xs text-cyber-muted">Scan this code with Google Authenticator</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="123456"
                                    className="bg-cyber-black border border-cyber-dim rounded px-3 py-2 w-24 text-center font-mono text-cyber-text"
                                    value={mfaCode}
                                    onChange={e => setMfaCode(e.target.value)}
                                />
                                <button onClick={verifyMfa} className="bg-green-600 text-white px-3 py-2 rounded text-sm">VERIFY</button>
                                <button onClick={() => setMfaSetup(null)} className="bg-cyber-gray/40 text-white px-3 py-2 rounded text-sm">CANCEL</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <span className="text-green-400 font-mono text-sm flex items-center gap-2">
                                <Shield size={16} /> MFA ACTIVE
                            </span>
                            <button onClick={disableMfa} className="text-red-500 hover:text-red-600 text-xs underline font-medium">Disable</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Settings;
