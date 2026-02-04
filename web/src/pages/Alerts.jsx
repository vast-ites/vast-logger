import React, { useState, useEffect } from 'react';
import { BellRing, Plus, Trash2, VolumeX, Volume2, Save, X } from 'lucide-react';

export const Alerts = () => {
    const [activeTab, setActiveTab] = useState('rules');
    const [rules, setRules] = useState([]);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showRuleModal, setShowRuleModal] = useState(false);
    const [showChannelModal, setShowChannelModal] = useState(false);
    const [showSilenceModal, setShowSilenceModal] = useState(false);
    const [selectedRule, setSelectedRule] = useState(null); // For silencing

    // Form States
    const [newRule, setNewRule] = useState({ name: '', metric: 'cpu_percent', host: '*', operator: '>', threshold: 80, channels: [] });
    const [newChannel, setNewChannel] = useState({ name: '', type: 'webhook', config: { url: '', email: '' } });
    const [silenceDuration, setSilenceDuration] = useState('1h');
    const [silenceHost, setSilenceHost] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        try {
            const [rulesRes, chansRes] = await Promise.all([
                fetch('/api/v1/alerts/rules', { headers }),
                fetch('/api/v1/alerts/channels', { headers })
            ]);
            if (rulesRes.ok) setRules(await rulesRes.json() || []);
            if (chansRes.ok) setChannels(await chansRes.json() || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleCreateRule = async () => {
        const token = localStorage.getItem('token');
        await fetch('/api/v1/alerts/rules', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newRule, threshold: parseFloat(newRule.threshold) })
        });
        setShowRuleModal(false);
        fetchData();
    };

    const handleDeleteRule = async (id) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/v1/alerts/rules/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchData();
    };

    const handleCreateChannel = async () => {
        const token = localStorage.getItem('token');
        const cfg = {};
        if (newChannel.type === 'webhook') cfg.url = newChannel.config.url;
        if (newChannel.type === 'email') cfg.email = newChannel.config.email;

        await fetch('/api/v1/alerts/channels', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newChannel.name, type: newChannel.type, config: cfg })
        });
        setShowChannelModal(false);
        fetchData();
    };

    const handleDeleteChannel = async (id) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/v1/alerts/channels/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchData();
    };

    const handleSilence = async () => {
        const token = localStorage.getItem('token');
        await fetch('/api/v1/alerts/silence', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule_id: selectedRule.id, host: silenceHost, duration: silenceDuration })
        });
        setShowSilenceModal(false);
        fetchData();
    };

    const handleUnsilence = async (ruleId, host) => {
        const token = localStorage.getItem('token');
        await fetch('/api/v1/alerts/unsilence', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule_id: ruleId, host })
        });
        fetchData();
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BellRing className="text-cyan-400" /> Alerting System
            </h1>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10 pb-1">
                <button onClick={() => setActiveTab('rules')} className={`px-4 py-2 text-sm font-semibold transition ${activeTab === 'rules' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Alert Rules</button>
                <button onClick={() => setActiveTab('channels')} className={`px-4 py-2 text-sm font-semibold transition ${activeTab === 'channels' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>Notification Channels</button>
            </div>

            {/* Rules Content */}
            {activeTab === 'rules' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowRuleModal(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm font-semibold">
                            <Plus size={16} /> Create Rule
                        </button>
                    </div>

                    <div className="grid gap-4">
                        {rules.map(rule => (
                            <div key={rule.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-white">{rule.name}</h3>
                                        <span className={`px-2 py-0.5 text-[10px] rounded ${rule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                            {rule.enabled ? 'ENABLED' : 'DISABLED'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1 font-mono">
                                        if <span className="text-cyan-300">{rule.metric}</span> {rule.operator} <span className="text-amber-300">{rule.threshold}</span> on <span className="text-violet-300">{rule.host}</span>
                                    </div>

                                    {/* Silenced Status */}
                                    {rule.silenced && Object.keys(rule.silenced).length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {Object.entries(rule.silenced).map(([host, expire]) => (
                                                <div key={host} className="flex items-center gap-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-500">
                                                    <VolumeX size={10} />
                                                    <span>Silenced on <b>{host}</b> until {new Date(expire).toLocaleTimeString()}</span>
                                                    <button onClick={() => handleUnsilence(rule.id, host)} className="hover:text-white"><X size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setSelectedRule(rule); setSilenceHost(rule.host === '*' ? '' : rule.host); setShowSilenceModal(true); }}
                                        className="p-2 bg-white/5 hover:bg-white/10 rounded text-amber-400" title="Silence Rule"
                                    >
                                        <VolumeX size={18} />
                                    </button>
                                    <button onClick={() => handleDeleteRule(rule.id)} className="p-2 bg-white/5 hover:bg-red-500/20 rounded text-red-500" title="Delete Rule"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                        {rules.length === 0 && !loading && <div className="text-center text-gray-500 py-10">No alert rules defined. Creates one to get started.</div>}
                    </div>
                </div>
            )}

            {/* Channels Content */}
            {activeTab === 'channels' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowChannelModal(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition text-sm font-semibold">
                            <Plus size={16} /> Add Channel
                        </button>
                    </div>
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        {channels.map(ch => (
                            <div key={ch.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-white">{ch.name}</h3>
                                        <div className="text-xs text-cyan-400 font-mono mt-1 uppercase">{ch.type}</div>
                                        <div className="text-sm text-gray-400 mt-2 break-all">{ch.config.url || ch.config.email}</div>
                                    </div>
                                    <button onClick={() => handleDeleteChannel(ch.id)} className="text-red-500 hover:text-red-400"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Rule Modal */}
            {showRuleModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Create Alert Rule</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Rule Name</label>
                                <input className="w-full bg-black/30 border border-white/10 rounded p-2 text-white focus:border-cyan-500 outline-none" placeholder="e.g. High CPU Load" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Metric</label>
                                    <select className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" value={newRule.metric} onChange={e => setNewRule({ ...newRule, metric: e.target.value })}>
                                        <option value="cpu_percent">CPU Usage (%)</option>
                                        <option value="memory_usage">Memory Usage (%)</option>
                                        <option value="disk_usage">Disk Usage (%)</option>
                                        <option value="net_recv_rate">Net Download (B/s)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Target Host</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" placeholder="* for Any" value={newRule.host} onChange={e => setNewRule({ ...newRule, host: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Operator</label>
                                    <select className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" value={newRule.operator} onChange={e => setNewRule({ ...newRule, operator: e.target.value })}>
                                        <option value=">">&gt; (Greater)</option>
                                        <option value="<">&lt; (Less)</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Threshold</label>
                                    <input type="number" className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" value={newRule.threshold} onChange={e => setNewRule({ ...newRule, threshold: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Notification Channels (Select Multiple)</label>
                                <select multiple className="w-full bg-black/30 border border-white/10 rounded p-2 text-white h-24 outline-none" onChange={e => setNewRule({ ...newRule, channels: Array.from(e.target.selectedOptions, o => o.value) })}>
                                    {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name} ({ch.type})</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleCreateRule} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold">Create Rule</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Channel Modal */}
            {showChannelModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Add Notification Channel</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Channel Name</label>
                                <input className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" placeholder="e.g. Critical Team Slack" value={newChannel.name} onChange={e => setNewChannel({ ...newChannel, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                        <input type="radio" checked={newChannel.type === 'webhook'} onChange={() => setNewChannel({ ...newChannel, type: 'webhook' })} /> Webhook
                                    </label>
                                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                        <input type="radio" checked={newChannel.type === 'email'} onChange={() => setNewChannel({ ...newChannel, type: 'email' })} /> Email
                                    </label>
                                </div>
                            </div>
                            {newChannel.type === 'webhook' && (
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Webhook URL</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" placeholder="https://discord.com/api/webhooks/..." value={newChannel.config.url} onChange={e => setNewChannel({ ...newChannel, config: { ...newChannel.config, url: e.target.value } })} />
                                </div>
                            )}
                            {newChannel.type === 'email' && (
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Email Address</label>
                                    <input className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" placeholder="oncall@company.com" value={newChannel.config.email} onChange={e => setNewChannel({ ...newChannel, config: { ...newChannel.config, email: e.target.value } })} />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowChannelModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleCreateChannel} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded font-bold">Add Channel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Silence Modal */}
            {showSilenceModal && selectedRule && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Silence Alert</h2>
                        <p className="text-sm text-gray-400 mb-4">Silence <strong className="text-white">{selectedRule.name}</strong>?</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Hostname (Optional)</label>
                                <input className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" placeholder="Specific Host or Empty for All" value={silenceHost} onChange={e => setSilenceHost(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Duration</label>
                                <select className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none" value={silenceDuration} onChange={e => setSilenceDuration(e.target.value)}>
                                    <option value="15m">15 Minutes</option>
                                    <option value="1h">1 Hour</option>
                                    <option value="6h">6 Hours</option>
                                    <option value="24h">24 Hours</option>
                                    <option value="72h">3 Days</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowSilenceModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleSilence} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold">Silence</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
