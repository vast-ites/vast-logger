import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Service-specific components
import ApacheDetail from './services/ApacheDetail';
import MySQLDetail from './services/MySQLDetail';
import PostgreSQLDetail from './services/PostgreSQLDetail';
import RedisDetail from './services/RedisDetail';
import MongoDBDetail from './services/MongoDBDetail';
import ClickHouseDetail from './services/ClickHouseDetail';
import InfluxDBDetail from './services/InfluxDBDetail';
import PM2Detail from './services/PM2Detail';

const ServiceDetail = () => {
    const { serviceName } = useParams();
    const navigate = useNavigate();

    const serviceComponents = {
        'apache': ApacheDetail,
        'apache2': ApacheDetail,
        'nginx': ApacheDetail,
        'httpd': ApacheDetail,
        'caddy': ApacheDetail,
        'traefik': ApacheDetail,
        'mysql': MySQLDetail,
        'mariadb': MySQLDetail,
        'postgresql': PostgreSQLDetail,
        'postgres': PostgreSQLDetail,
        'redis': RedisDetail,
        'mongodb': MongoDBDetail,
        'mongod': MongoDBDetail,
        'clickhouse': ClickHouseDetail,
        'datavast-clickhouse': ClickHouseDetail,
        'influxdb': InfluxDBDetail,
        'datavast-influxdb': InfluxDBDetail,
        'pm2': PM2Detail,
    };

    const Component = serviceComponents[serviceName.toLowerCase()];

    if (Component) {
        return <Component />;
    }

    // Fallback for unsupported services
    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/services')}
                    className="p-2 rounded-lg hover:bg-cyber-gray/50 border border-cyber-dim transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-cyber-cyan" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-cyber-text capitalize">{serviceName}</h1>
                    <p className="text-cyber-muted mt-1">Service Monitoring & Analytics</p>
                </div>
            </div>

            {/* Service-specific component fallback */}
            <div className="glass-panel rounded-lg p-8 text-center">
                <h2 className="text-xl text-cyber-text mb-2">Service Detail Page</h2>
                <p className="text-cyber-muted">
                    Detailed monitoring for <span className="text-cyber-cyan font-semibold">{serviceName}</span> will be displayed here.
                </p>
                <p className="text-cyber-muted/70 mt-4 text-sm">
                    Implementation in progress...
                </p>
            </div>
        </div>
    );

};

export default ServiceDetail;
