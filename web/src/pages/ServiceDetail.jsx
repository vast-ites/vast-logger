import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Service-specific components
import ApacheDetail from './services/ApacheDetail';
// import MySQLDetail from './services/MySQLDetail';
// import PostgreSQLDetail from './services/PostgreSQLDetail';
// import RedisDetail from './services/RedisDetail';

const ServiceDetail = () => {
    const { serviceName } = useParams();
    const navigate = useNavigate();

    const serviceComponents = {
        'apache': ApacheDetail,
        'apache2': ApacheDetail,
        'nginx': ApacheDetail,  // Reuse for Nginx
        'httpd': ApacheDetail,
        // 'mysql': MySQLDetail,
        // 'postgresql': PostgreSQLDetail,
        // 'postgres': PostgreSQLDetail,
        // 'redis': RedisDetail,
    };

    const Component = serviceComponents[serviceName.toLowerCase()];

    if (Component) {
        return <Component />;
    }

    // Fallback for unsupported services
    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/services')}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-cyan-500/30 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-cyan-400" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white capitalize">{serviceName}</h1>
                    <p className="text-gray-400 mt-1">Service Monitoring & Analytics</p>
                </div>
            </div>

            {/* Service-specific component */}
            <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-8 text-center">
                <h2 className="text-xl text-white mb-2">Service Detail Page</h2>
                <p className="text-gray-400">
                    Detailed monitoring for <span className="text-cyan-400 font-semibold">{serviceName}</span> will be displayed here.
                </p>
                <p className="text-gray-500 mt-4 text-sm">
                    Implementation in progress...
                </p>
            </div>
        </div>
    );
};

export default ServiceDetail;
