import React, { useEffect, useState, useRef } from 'react';

/**
 * SpeedometerGauge - An animated SVG speedometer-style gauge.
 * 
 * Props:
 * - value: number (0-100) — current percentage
 * - label: string — metric label (e.g. "CPU", "RAM", "DISK")
 * - icon: React component — optional lucide icon
 * - color: 'cyan' | 'violet' | 'amber' | 'green' — accent color
 * - subtitle: string — optional text below the value
 * - size: number — diameter in pixels (default 200)
 */
const SpeedometerGauge = ({ value = 0, label = '', icon: Icon, color = 'cyan', subtitle = '', size = 200 }) => {
    const [animatedValue, setAnimatedValue] = useState(0);
    const animRef = useRef(null);
    const prevValueRef = useRef(0);

    // Animate to new value
    useEffect(() => {
        const from = prevValueRef.current;
        const to = Math.min(100, Math.max(0, value));
        const duration = 800;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = from + (to - from) * eased;

            setAnimatedValue(current);

            if (progress < 1) {
                animRef.current = requestAnimationFrame(animate);
            } else {
                prevValueRef.current = to;
            }
        };

        animRef.current = requestAnimationFrame(animate);
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [value]);

    // SVG arc parameters
    const cx = size / 2;
    const cy = size / 2;
    const strokeWidth = size * 0.06;
    const radius = (size / 2) - strokeWidth - (size * 0.08);

    // Arc spans 240 degrees (from 150° to 390°, i.e. -210° to 30°)
    const startAngle = 150;
    const endAngle = 390;
    const totalAngle = endAngle - startAngle;

    // Convert angle to radians and get point on arc
    const polarToCartesian = (angle) => {
        const rad = (angle - 90) * (Math.PI / 180);
        return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad),
        };
    };

    // Create SVG arc path
    const createArc = (start, end) => {
        const s = polarToCartesian(start);
        const e = polarToCartesian(end);
        const largeArc = (end - start) > 180 ? 1 : 0;
        return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
    };

    // Current needle angle
    const needleAngle = startAngle + (animatedValue / 100) * totalAngle;
    const needleEnd = polarToCartesian(needleAngle);
    const needleLength = radius - (size * 0.04);
    const needleRad = (needleAngle - 90) * (Math.PI / 180);
    const needleTip = {
        x: cx + needleLength * Math.cos(needleRad),
        y: cy + needleLength * Math.sin(needleRad),
    };

    // Color mappings
    const colorMap = {
        cyan: {
            gradient: ['#00f3ff', '#0891b2'],
            glow: 'rgba(0, 243, 255, 0.4)',
            text: 'text-cyan-400',
            needleColor: '#00f3ff',
        },
        violet: {
            gradient: ['#bc13fe', '#7c3aed'],
            glow: 'rgba(188, 19, 254, 0.4)',
            text: 'text-violet-400',
            needleColor: '#bc13fe',
        },
        amber: {
            gradient: ['#f59e0b', '#d97706'],
            glow: 'rgba(245, 158, 11, 0.4)',
            text: 'text-amber-400',
            needleColor: '#f59e0b',
        },
        green: {
            gradient: ['#10b981', '#059669'],
            glow: 'rgba(16, 185, 129, 0.4)',
            text: 'text-emerald-400',
            needleColor: '#10b981',
        },
    };

    const c = colorMap[color] || colorMap.cyan;
    const gaugeId = `gauge-${label}-${color}`.replace(/\s/g, '-');

    // Zone colors for the arc (green -> amber -> red)
    const getZoneColor = (percent) => {
        if (percent <= 60) return '#10b981';  // green
        if (percent <= 80) return '#f59e0b';  // amber
        return '#ef4444';                      // red
    };

    // Create zone segments
    const zones = [
        { start: 0, end: 60, color: '#10b981' },
        { start: 60, end: 80, color: '#f59e0b' },
        { start: 80, end: 100, color: '#ef4444' },
    ];

    // Tick marks
    const ticks = [0, 25, 50, 75, 100];

    return (
        <div className="flex flex-col items-center" style={{ width: size, height: size + 30 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <defs>
                    {/* Gradient for active arc */}
                    <linearGradient id={`${gaugeId}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={c.gradient[0]} stopOpacity="1" />
                        <stop offset="100%" stopColor={c.gradient[1]} stopOpacity="1" />
                    </linearGradient>

                    {/* Glow filter */}
                    <filter id={`${gaugeId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>

                    {/* Needle glow */}
                    <filter id={`${gaugeId}-needle-glow`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Background zone arcs */}
                {zones.map((zone, i) => {
                    const zoneStart = startAngle + (zone.start / 100) * totalAngle;
                    const zoneEnd = startAngle + (zone.end / 100) * totalAngle;
                    return (
                        <path
                            key={i}
                            d={createArc(zoneStart, zoneEnd)}
                            fill="none"
                            stroke={zone.color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            opacity={0.15}
                        />
                    );
                })}

                {/* Active arc (filled portion) */}
                {animatedValue > 0.5 && (
                    <path
                        d={createArc(startAngle, startAngle + (animatedValue / 100) * totalAngle)}
                        fill="none"
                        stroke={getZoneColor(animatedValue)}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        filter={`url(#${gaugeId}-glow)`}
                        style={{ transition: 'stroke 0.3s ease' }}
                    />
                )}

                {/* Tick marks */}
                {ticks.map((tick) => {
                    const angle = startAngle + (tick / 100) * totalAngle;
                    const outerR = radius + strokeWidth / 2 + 2;
                    const innerR = radius + strokeWidth / 2 + (size * 0.04);
                    const rad = (angle - 90) * (Math.PI / 180);
                    const x1 = cx + outerR * Math.cos(rad);
                    const y1 = cy + outerR * Math.sin(rad);
                    const x2 = cx + innerR * Math.cos(rad);
                    const y2 = cy + innerR * Math.sin(rad);

                    // Label position
                    const labelR = radius + strokeWidth / 2 + (size * 0.1);
                    const lx = cx + labelR * Math.cos(rad);
                    const ly = cy + labelR * Math.sin(rad);

                    return (
                        <g key={tick}>
                            <line
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke="rgba(203, 213, 225, 0.3)"
                                strokeWidth={1.5}
                            />
                            <text
                                x={lx} y={ly}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="rgba(203, 213, 225, 0.5)"
                                fontSize={size * 0.05}
                                fontFamily="'Fira Code', monospace"
                            >
                                {tick}
                            </text>
                        </g>
                    );
                })}

                {/* Needle */}
                <line
                    x1={cx} y1={cy}
                    x2={needleTip.x} y2={needleTip.y}
                    stroke={getZoneColor(animatedValue)}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    filter={`url(#${gaugeId}-needle-glow)`}
                    style={{ transition: 'stroke 0.3s ease' }}
                />

                {/* Needle hub */}
                <circle cx={cx} cy={cy} r={size * 0.03} fill={getZoneColor(animatedValue)} opacity={0.8} />
                <circle cx={cx} cy={cy} r={size * 0.015} fill="rgb(var(--cyber-dark))" />

                {/* Center value */}
                <text
                    x={cx}
                    y={cy + size * 0.12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={getZoneColor(animatedValue)}
                    fontSize={size * 0.17}
                    fontFamily="'Orbitron', sans-serif"
                    fontWeight="700"
                    style={{ transition: 'fill 0.3s ease' }}
                >
                    {animatedValue.toFixed(1)}%
                </text>

                {/* Icon + Label */}
                <text
                    x={cx}
                    y={cy - size * 0.08}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(203, 213, 225, 0.8)"
                    fontSize={size * 0.065}
                    fontFamily="'Orbitron', sans-serif"
                    fontWeight="500"
                    letterSpacing="0.1em"
                >
                    {label}
                </text>
            </svg>

            {/* Subtitle below gauge */}
            {subtitle && (
                <div className="text-xs text-cyber-muted font-mono mt-1 text-center truncate max-w-full">
                    {subtitle}
                </div>
            )}
        </div>
    );
};

export default SpeedometerGauge;
