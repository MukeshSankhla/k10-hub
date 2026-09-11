import { useEffect, useRef } from 'react';

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    // Mouse coordinates for subtle interactive torch on the square grid
    const mouse = { x: width * 0.5, y: height * 0.45, targetX: width * 0.5, targetY: height * 0.45, isHovering: false };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.isHovering = true;
    };

    const handleMouseLeave = () => {
      mouse.targetX = width * 0.5;
      mouse.targetY = height * 0.45;
      mouse.isHovering = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
      renderGrid();
    };

    const renderGrid = () => {
      ctx.clearRect(0, 0, width, height);

      const majorStep = 64;
      const minorStep = 16;

      // 1. Minor Sub-Grid
      ctx.strokeStyle = 'rgba(29, 78, 216, 0.035)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += minorStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += minorStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Major Square Grid
      ctx.strokeStyle = 'rgba(29, 78, 216, 0.085)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += majorStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += majorStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 3. Precision Engineering Crosshairs (+) at Intersections
      ctx.strokeStyle = 'rgba(29, 78, 216, 0.22)';
      ctx.lineWidth = 1;
      const crossSize = 3.5;
      ctx.beginPath();
      for (let x = 0; x <= width; x += majorStep) {
        for (let y = 0; y <= height; y += majorStep) {
          ctx.moveTo(x - crossSize, y);
          ctx.lineTo(x + crossSize, y);
          ctx.moveTo(x, y - crossSize);
          ctx.lineTo(x, y + crossSize);
        }
      }
      ctx.stroke();

      // 4. Subtle Interactive Spotlight on Mouse Position
      if (mouse.isHovering) {
        const spotGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 320);
        spotGlow.addColorStop(0, 'rgba(29, 78, 216, 0.06)');
        spotGlow.addColorStop(0.5, 'rgba(29, 78, 216, 0.02)');
        spotGlow.addColorStop(1, 'transparent');

        ctx.fillStyle = spotGlow;
        ctx.fillRect(0, 0, width, height);
      }

      // 5. Technical Blueprint Calibration Coordinates
      ctx.font = '500 9px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(29, 78, 216, 0.35)';

      // Corner technical stamps
      ctx.fillText('REF: UNIHIKER-K10 // SCALE: 1:1 // GRID: 64mm', 24, 30);
      ctx.fillText('COORDINATE PLANE [X: 00..2560 · Y: 00..1440]', width - 320, 30);

      // Ruler edge marks
      ctx.fillStyle = 'rgba(29, 78, 216, 0.2)';
      for (let x = majorStep; x < width - 100; x += majorStep * 3) {
        ctx.fillText(`+${Math.round(x)}`, x + 4, 16);
      }
      for (let y = majorStep * 2; y < height - 60; y += majorStep * 2) {
        ctx.fillText(`+${Math.round(y)}`, 8, y - 4);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Smooth torch interpolation
    let animId: number;
    const tick = () => {
      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;
      renderGrid();
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      className="hero__motion-canvas"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
