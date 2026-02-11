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
  
  const [debugTarget, setDebugTarget] = useState<number | null>(null);
  const rotationRef = useRef(0);
  const speedRef = useRef(0);
  const targetIdxRef = useRef<number | null>(null);
  const requestRef = useRef<number>(0);
  
  const inputBufRef = useRef('');
  const ctrlPressStartTimeRef = useRef<number>(0);

  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC926'];
  const FRICTION = 0.988;
  const CRUISE_SPEED = 0.07;

  // PCイカサマロジック
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSpinning) return;
      if (/^[0-9]$/.test(e.key)) {
        inputBufRef.current = (inputBufRef.current + e.key).slice(-2);
      }
      if (e.key === 'Control' && ctrlPressStartTimeRef.current === 0) {
        ctrlPressStartTimeRef.current = Date.now();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        const pressDuration = Date.now() - ctrlPressStartTimeRef.current;
        if (pressDuration > 500) {
          const num = parseInt(inputBufRef.current);
          if (!isNaN(num) && num > 0) {
            const idx = (num - 1) % items.length;
            targetIdxRef.current = idx;
            setDebugTarget(num);
            if (navigator.vibrate) navigator.vibrate([30]);
          }
          inputBufRef.current = '';
        }
        ctrlPressStartTimeRef.current = 0;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [items.length, isSpinning]);

  // タップ仕込みロジック
  const handleAction = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSpinning) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = clientX - (rect.left + rect.width / 2);
    const y = clientY - (rect.top + rect.height / 2);
    let angle = Math.atan2(y, x) / (Math.PI * 2) + 0.25;
    if (angle < 0) angle += 1;
    const n = items.length;
    const currentRot = rotationRef.current % 1.0;
    let normalizedAngle = (angle - currentRot + 1.0) % 1.0;
    const tappedIdx = Math.floor(normalizedAngle * n);
    targetIdxRef.current = tappedIdx;
    setDebugTarget(tappedIdx + 1);
    if (navigator.vibrate) navigator.vibrate(20);
  };

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
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
      
      ctx.save(); ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + (arc * Math.PI));
      ctx.textAlign = 'right'; ctx.fillStyle = 'white';
      const fontSize = n > 15 ? 10 : 18;
      ctx.font = `bold ${fontSize}px sans-serif`;
      const hasText = text.trim() !== '';
      ctx.fillText(hasText ? `${i + 1}.${text}` : `${i + 1}`, radius - 15, fontSize / 3);
      ctx.restore();
    });

    ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); ctx.translate(centerX, 5); ctx.fillStyle = '#ff4757';
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(0, 25);
    ctx.closePath(); ctx.fill(); ctx.restore();
  };

  useEffect(() => { draw(); }, [items]);

  const startSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true); setIsStopping(false);
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
      while (finalDistance < naturalDistance) finalDistance += 1.0;
      speedRef.current = finalDistance * (1 - FRICTION);
    }
    const animateStop = () => {
      rotationRef.current = (rotationRef.current + speedRef.current) % 1.0;
      speedRef.current *= FRICTION;
      draw();
      if (speedRef.current > 0.0001) {
        requestRef.current = requestAnimationFrame(animateStop);
      } else {
        setIsSpinning(false); setIsStopping(false);
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

  return (
    <main className="min-h-[100dvh] bg-[#F1F3F5] flex flex-col items-center justify-between p-6 select-none relative font-sans text-slate-800">
      
      {/* 背景パターン */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', size: '20px 20px' }}></div>

      {/* ヘッダー */}
      <header className="w-full max-w-lg flex justify-between items-center z-10 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#228be6] rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
            <span className="text-white font-black text-xl italic">R</span>
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-800 uppercase italic">Roulette <span className="text-[#228be6]">Pro</span></h1>
        </div>
        <div className="flex gap-4 text-[10px] font-bold text-slate-400">
          <span>V2.4.1</span>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 w-full">
        <div className="relative mb-8 p-3 bg-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white">
          <canvas 
            ref={canvasRef} 
            width={360} height={360} 
            className="rounded-full cursor-pointer w-[75vw] h-[75vw] max-w-[320px] max-h-[320px]"
            onMouseDown={handleAction}
            onTouchStart={handleAction}
          />
        </div>

        <div className="w-full max-w-[280px] space-y-4">
          {!isSpinning ? (
            <button 
              onClick={startSpin} 
              className="w-full bg-[#228be6] hover:bg-[#1c7ed6] text-white py-4 rounded-2xl font-black text-xl shadow-[0_8px_0_rgb(28,126,214)] active:shadow-none active:translate-y-[8px] transition-all"
            >
              スタート
            </button>
          ) : (
            <button 
              onClick={stopSpin} 
              disabled={isStopping} 
              className={`w-full ${isStopping ? 'bg-slate-300 shadow-none translate-y-[8px]' : 'bg-[#fab005] shadow-[0_8px_0_rgb(233,160,0)] active:shadow-none active:translate-y-[8px]'} text-white py-4 rounded-2xl font-black text-xl transition-all`}
            >
              {isStopping ? '...' : 'ストップ'}
            </button>
          )}
          
          <div className="flex flex-col gap-1 items-center">
            <button 
              onClick={() => { setTempItems([...items]); setShowSettings(true); }} 
              disabled={isSpinning}
              className={`text-slate-500 text-sm font-bold border-b-2 border-slate-200 pb-0.5 transition-all ${isSpinning ? 'opacity-0' : 'hover:border-blue-400 hover:text-blue-500'}`}
            >
              項目を編集する
            </button>
            <p className="text-[9px] text-slate-300 font-medium mt-2">© 2026 Roulette Pro Service</p>
          </div>
        </div>
      </div>

      {/* 設定モーダル */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm p-6 rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">項目設定</h2>
              <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full font-bold">総数: {tempItems.length}</span>
            </div>
            <div className="space-y-2 overflow-y-auto mb-6 pr-1 custom-scrollbar">
              {tempItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center bg-slate-50 p-1 rounded-xl pr-3 border border-slate-100">
                  <span className="text-slate-300 font-black w-8 text-center text-xs">{i + 1}</span>
                  <input value={item} placeholder="項目名..." onChange={(e) => { const n = [...tempItems]; n[i] = e.target.value; setTempItems(n); }} className="flex-grow bg-transparent border-none px-1 py-2 text-sm font-bold outline-none" />
                  <button onClick={() => setTempItems(tempItems.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500 transition-colors">×</button>
                </div>
              ))}
              <button onClick={() => setTempItems([...tempItems, ''])} className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl font-bold text-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-400 transition-all">+ 項目を追加</button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSettings(false)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-sm">閉じる</button>
              <button onClick={() => { setItems([...tempItems]); setShowSettings(false); }} className="flex-1 bg-[#228be6] py-4 rounded-2xl font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-600 transition-colors text-sm">更新</button>
            </div>
          </div>
        </div>
      )}

      {/* 当選モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-white/95 z-[100] flex items-center justify-center p-8 text-center animate-in fade-in duration-300" onClick={() => setShowModal(false)}>
          <div className="max-w-xs">
            <div className="w-12 h-1 bg-blue-500 mx-auto mb-6 rounded-full"></div>
            <h2 className="text-6xl font-black text-slate-900 leading-tight mb-12 tracking-tighter break-all">{result}</h2>
            <div className="cursor-pointer inline-flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-full text-xs font-bold tracking-[0.2em] shadow-xl hover:scale-105 transition-transform uppercase">
              OK
            </div>
          </div>
        </div>
      )}
    </main>
  );
}