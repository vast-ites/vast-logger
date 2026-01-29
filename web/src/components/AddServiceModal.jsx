import React, { useState } from 'react';
import {
    X, Check, Copy, Server, FileText, Database,
    Terminal, Shield, Settings
} from 'lucide-react';

const SERVICE_TEMPLATES = {
    'nginx': {
        name: 'Nginx Web Server',
        icon: Globe,
        description: 'Monitor Nginx access and error logs.',
        config: {
            "collectors": { "nginx": true },
            "log_config": {
                "selected_logs": ["/var/log/nginx/access.log", "/var/log/nginx/error.log"]
            }
        }
    },
    'apache': {
        name: 'Apache HTTP Server',
        icon: Server,
        description: 'Monitor Apache/Httpd logs.',
        config: {
            "collectors": { "apache": true },
            "log_config": {
                "selected_logs": ["/var/log/apache2/access.log", "/var/log/apache2/error.log"]
            }
        }
    },
    'pm2': {
        name: 'PM2 Process Manager',
        icon: Terminal,
        description: 'Monitor Node.js applications managed by PM2.',
        config: {
            "collectors": { "pm2": true },
            "log_config": {
                "selected_logs": ["~/.pm2/logs/*.log"]
            }
        }
    },
    'custom': {
        name: 'Custom Log File',
        icon: FileText,
        description: 'Monitor any specific log file on the system.',
        config: {
            "log_config": {
                "selected_logs": ["/path/to/your/application.log"]
            }
        }
    }
};

// Icon component mapper because we can't store components in JSON effectively above without messy structure
import { Globe } from 'lucide-react';

const AddServiceModal = ({ isOpen, onClose }) => {
    const [selectedService, setSelectedService] = useState(null);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        if (!selectedService) return;
        const snippet = JSON.stringify(SERVICE_TEMPLATES[selectedService].config, null, 2);
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const currentTemplate = selectedService ? SERVICE_TEMPLATES[selectedService] : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white">Add Service Integration</h2>
                        <p className="text-sm text-gray-400">Select a service to generate configuration.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="flex h-[450px]">
                    {/* Sidebar List */}
                    <div className="w-1/3 border-r border-gray-800 bg-black/20 overflow-y-auto">
                        {Object.entries(SERVICE_TEMPLATES).map(([key, template]) => {
                            const Icon = template.icon || Server;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedService(key)}
                                    className={`w-full text-left p-4 flex items-center gap-3 transition-colors border-l-2
                    ${selectedService === key
                                            ? 'bg-cyan-900/20 border-cyan-500 text-white'
                                            : 'border-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200'}
                  `}
                                >
                                    <Icon size={18} />
                                    <span className="font-medium text-sm">{template.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Details Panel */}
                    <div className="w-2/3 bg-gray-900 flex flex-col h-full">
                        {currentTemplate ? (
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="mb-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-cyan-500/10 rounded-lg">
                                            {React.createElement(currentTemplate.icon || Server, { size: 24, className: 'text-cyan-400' })}
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{currentTemplate.name}</h3>
                                    </div>
                                    <p className="text-gray-400 text-sm">{currentTemplate.description}</p>
                                </div>

                                <div className="bg-black/50 rounded-lg border border-gray-800 p-4 font-mono text-sm overflow-hidden flex flex-col mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-gray-500 uppercase tracking-wider">agent-config.json snippet</span>
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                        >
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                            {copied ? 'Copied!' : 'Copy JSON'}
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <pre className="text-gray-300 whitespace-pre-wrap">
                                            {JSON.stringify(currentTemplate.config, null, 2)}
                                        </pre>
                                    </div>
                                </div>

                                <div className="p-4 bg-yellow-900/20 border border-yellow-900/50 rounded-lg">
                                    <h4 className="flex items-center gap-2 text-yellow-500 font-bold text-sm mb-1">
                                        <Terminal size={14} />
                                        Instructions
                                    </h4>
                                    <ol className="list-decimal list-inside text-xs text-gray-400 space-y-1 ml-1">
                                        <li>SSH into your server.</li>
                                        <li>Open <code className="bg-black/30 px-1 rounded text-gray-300">agent-config.json</code></li>
                                        <li>Merge the snippet above into your config.</li>
                                        <li>Restart the agent: <code className="bg-black/30 px-1 rounded text-gray-300">systemctl restart datavast-agent</code></li>
                                    </ol>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <Settings size={48} className="mb-4 opacity-20" />
                                <p>Select a service to view configuration.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AddServiceModal;
