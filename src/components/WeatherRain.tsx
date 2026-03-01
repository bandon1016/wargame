import React, { useEffect, useRef } from 'react';

interface WeatherRainProps {
    weather: 'rainy' | 'stormy';
}

export const WeatherRain: React.FC<WeatherRainProps> = ({ weather }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = canvas.clientWidth;
        let height = canvas.clientHeight;

        const resize = () => {
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', resize);
        resize();

        // 參數設定
        const isStormy = weather === 'stormy';
        const dropletCount = isStormy ? 150 : 80;
        const speedBase = isStormy ? 8 : 4; // 速度不要太快
        const angleX = -20; // 傾斜角度

        interface RainDrop {
            x: number;
            y: number;
            len: number;
            speed: number;
            opacity: number;
        }

        const raindrops: RainDrop[] = Array.from({ length: dropletCount }, () => ({
            x: Math.random() * (width + 200) - 100,
            y: Math.random() * height,
            len: Math.random() * 20 + 30, // 雨絲長度
            speed: (Math.random() * 0.5 + 0.8) * speedBase,
            opacity: Math.random() * 0.2 + 0.05
        }));

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';

            raindrops.forEach(drop => {
                ctx.strokeStyle = `rgba(174, 214, 241, ${drop.opacity})`;
                ctx.beginPath();
                ctx.moveTo(drop.x, drop.y);
                // 計算斜下的終點
                const endX = drop.x + Math.tan(angleX * Math.PI / 180) * drop.len;
                const endY = drop.y + drop.len;
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // 更新位置
                drop.y += drop.speed;
                drop.x += Math.tan(angleX * Math.PI / 180) * drop.speed;

                // 回到頂部循環
                if (drop.y > height + 20) {
                    drop.y = -drop.len;
                    drop.x = Math.random() * (width + 200) - 100;
                }
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [weather]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-[490] pointer-events-none w-full h-full"
            style={{ background: weather === 'stormy' ? 'rgba(20, 40, 70, 0.05)' : 'rgba(30, 60, 90, 0.02)' }}
        />
    );
};
