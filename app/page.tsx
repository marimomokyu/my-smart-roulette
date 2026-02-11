'use client';

import { useState, useRef, useEffect } from 'react';

export default function RoulettePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [items, setItems] = useState(['', '', '', '', '']);
  const [tempItems, setTempItems] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [result, setResult] = useState('');

  // 内部的なイカサマ用ステート（デバッグ表示は消すがロジックは維持）
  const [debugTarget, setDebugTarget] = useState<number | null>(null);

  const rotationRef = useRef(0);
  const speedRef = useRef(0);
  const targetIdxRef = useRef<number | null>(null);
  const requestRef = useRef<number>(0);
  
  const inputBufRef = useRef('');
  const ctrlTimerRef = useRef<NodeJS.Timeout | null>(null);

  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC926'];
  const FRICTION = 0.988;
  const CRUISE_SPEED = 0.07;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const n = items.length;
    const arc = 1 / n;
    const centerX = 180; const centerY = 180; const radius = 170;
    ctx.clearRect(0, 0, 360, 360);

    items.forEach((text, i) => {
      const startAngle = (rotationRef.current + i * arc - 0.25) * Math.PI * 2;
      const endAngle = (rotationRef.current + (i + 1) * arc - 0.25) * Math.PI * 2;
      
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath(); ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + (arc * Math.PI));
      ctx.textAlign = 'right'; ctx.fillStyle = 'white';
      const fontSize = n > 15 ? 10 : 18;
      ctx.font = `bold ${fontSize}px sans-serif`;

      const hasText = text.trim() !== '';
      const displayText = hasText ? `${i + 1}.${text}` : `${i + 1}`;
      
      ctx.fillText(displayText, radius - 15, fontSize / 3);
      ctx.restore();
    });

    ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 4; ctx.stroke();

    // モダンなインジケーター（針）
    ctx.save();
    ctx.translate(centerX, 5);
    ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(0, 25);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(0, 2); ctx.lineTo(0, 18);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        inputBufRef.current = (inputBufRef.current + e.key).slice(-2);
      }
      if (e.key === 'Control') {
        if (!ctrlTimerRef.current) {
          ctrlTimerRef.current = setTimeout(() => {
            const num = parseInt(inputBufRef.current);
            if (!isNaN(num) && num > 0) {
              targetIdxRef.current = (num - 1) % items.length;
              setDebugTarget(num);
            }
            inputBufRef.current = '';
          }, 1000);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length]);

  useEffect(() => { draw(); }, [items]);

  const startSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setIsStopping(false);
    speedRef.current = CRUISE_SPEED;
    const loop = () => {
      rotationRef.current = (rotationRef.current + speedRef.current) % 1.0;
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
  };

  const stopSpin = () => {
    if (!isSpinning || isStopping) return;
    setIsStopping(true);
    cancelAnimationFrame(requestRef.current);

    if (targetIdxRef.current !== null) {
      const n = items.length;
      const stopPos = (10.0 - (targetIdxRef.current / n) - (0.5 / n)) % 1.0;
      const currentPos = rotationRef.current % 1.0;
      const naturalDistance = speedRef.current / (1 - FRICTION);
      let finalDistance = (stopPos - currentPos + 1.0) % 1.0;
      while (finalDistance < naturalDistance) {
        finalDistance += 1.0;
      }
      speedRef.current = finalDistance * (1 - FRICTION);
    }

    const animateStop = () => {
      rotationRef.current = (rotationRef.current + speedRef.current) % 1.0;
      speedRef.current *= FRICTION;
      draw();
      if (speedRef.current > 0.0001) {
        requestRef.current = requestAnimationFrame(animateStop);
      } else {
        setIsSpinning(false);
        setIsStopping(false);
        const n = items.length;
        const finalPos = (1.0 - (rotationRef.current % 1.0) + 1.0) % 1.0;
        const winIdx = Math.floor((finalPos * n + 0.01)) % n;
        
        const winText = items[winIdx].trim();
        setResult(winText !== '' ? `${winIdx + 1}.${winText}` : `${winIdx + 1}`);
        
        setShowModal(true);
        targetIdxRef.current = null;
        setDebugTarget(null);
      }
    };
    requestRef.current = requestAnimationFrame(animateStop);
  };

  // スマホ用隠しコマンド（画面全体どこでもタッチで1番固定）
  const handleTouchStart = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !isSpinning) {
      targetIdxRef.current = 0;
    }
  };

  return (
    <main 
      className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-6 select-none relative"
      onTouchStart={handleTouchStart}
    >
      {/* <div className="fixed top-4 left-4 bg-slate-800 text-white p-2 rounded font-mono text-[10px] z-[200]">
          DEBUG: Target[{debugTarget || 'OFF'}]
        </div>
      */}

      <div className="relative mb-12 p-4 bg-white rounded-full shadow-2xl">
        <div className="absolute inset-0 rounded-full border-[6px] border-slate-100 -z-10" />
        <canvas ref={canvasRef} width={360} height={360} className="rounded-full" />
      </div>

      <div className="w-full max-w-xs space-y-4">
        {!isSpinning ? (
          <button onClick={startSpin} className="w-full bg-[#228be6] hover:bg-[#1c7ed6] text-white py-4 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all tracking-widest uppercase">Start</button>
        ) : (
          <button onClick={stopSpin} disabled={isStopping} className="w-full bg-[#fab005] hover:bg-[#f59f00] text-white disabled:bg-slate-300 py-4 rounded-2xl font-black text-xl active:scale-95 transition-all tracking-widest uppercase">Stop</button>
        )}
        <button onClick={() => { setTempItems([...items]); setShowSettings(true); }} className="w-full text-slate-400 text-xs font-bold tracking-[0.2em] text-center uppercase py-2 hover:text-slate-600 transition-colors">項目を編集</button>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl flex flex-col max-h-[80vh]">
            <h2 className="text-xl font-black mb-6 text-slate-800 tracking-tight">項目を編集</h2>
            <div className="space-y-3 overflow-y-auto mb-6 pr-2">
              {tempItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center group">
                  <span className="text-slate-300 font-black w-8 text-center text-sm">{i + 1}</span>
                  <input value={item} placeholder="項目を入力..." onChange={(e) => { const n = [...tempItems]; n[i] = e.target.value; setTempItems(n); }} className="flex-grow bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none" />
                  <button onClick={() => setTempItems(tempItems.filter((_, idx) => idx !== i))} className="text-slate-300 group-hover:text-rose-400 p-2 transition-colors">×</button>
                </div>
              ))}
              <button onClick={() => setTempItems([...tempItems, ''])} className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl font-bold hover:bg-slate-50 transition-colors">+ 追加</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSettings(false)} className="flex-1 bg-slate-100 py-3 rounded-2xl font-bold text-slate-500">閉じる</button>
              <button onClick={() => { setItems([...tempItems]); setShowSettings(false); }} className="flex-1 bg-[#228be6] py-3 rounded-2xl font-bold text-white shadow-md">保存</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-center justify-center p-8" onClick={() => setShowModal(false)}>
          <div className="text-center">
            <p className="text-blue-400 font-black mb-4 tracking-[0.3em] uppercase text-sm">Winner</p>
            <h2 className="text-7xl font-black text-white leading-tight drop-shadow-2xl">{result}</h2>
            <p className="mt-12 text-white/30 text-xs font-bold tracking-widest uppercase animate-pulse">Tap to continue</p>
          </div>
        </div>
      )}
    </main>
  );
}