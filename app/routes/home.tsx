import React, { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Trash2, Trophy, RotateCcw, Play, RefreshCw, XCircle, Edit2, Check, Settings, Lock } from 'lucide-react';

// Konstanta Default Template WhatsApp
const defaultWinnerTemplate = `🎉 *PEMENANG ARISAN* 🎉\n\nSelamat kepada:\n👉 *{{PEMENANG}}* 👈\n\nTelah mendapatkan arisan di kelompok *{{NAMA_ARISAN}}*! 🏆✨\n\nSemoga berkah dan bermanfaat! 💸💸\n\n_Diputar secara adil menggunakan Roda Arisan Digital_ 🎡`;

const defaultStatusTemplate = `📊 *UPDATE ARISAN: {{NAMA_ARISAN}}* 📊\n\n📝 *Ringkasan:* \n- Total Anggota: {{TOTAL}}\n- Sudah Dapat: {{SUDAH_DAPAT}}\n- Belum Dapat: {{BELUM_DAPAT}}\n\n🏆 *SUDAH DAPAT (LUNAS):*\n{{DAFTAR_SUDAH}}\n\n⏳ *BELUM DAPAT (ANTRI):*\n{{DAFTAR_BELUM}}\n\n_Mari kita nantikan kocokan berikutnya!_ 🎡✨`;

// Custom hook untuk menyimpan data ke Local Storage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Error reading localStorage", error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default function App() {
  const [participants, setParticipants] = useLocalStorage('arisan_participants', []);
  const [arisanTitle, setArisanTitle] = useLocalStorage('arisan_title', 'Daftar Peserta');
  const [inputNames, setInputNames] = useState(''); 
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(arisanTitle);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0); 
  const [winners, setWinners] = useState([]); 
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // --- STATE RAHASIA ---
  const [secretClicks, setSecretClicks] = useState(0);
  const [showSecretMenu, setShowSecretMenu] = useState(false);
  const [targetWinnerIds, setTargetWinnerIds] = useState([]);

  // Template WhatsApp state
  const [waTemplateWinner, setWaTemplateWinner] = useLocalStorage('arisan_wa_winner', defaultWinnerTemplate);
  const [waTemplateStatus, setWaTemplateStatus] = useLocalStorage('arisan_wa_status', defaultStatusTemplate);

  // State untuk Dialog Kustom (Pengganti alert dan confirm bawaan browser)
  const [customAlert, setCustomAlert] = useState(null); // { message }
  const [customConfirm, setCustomConfirm] = useState(null); // { message, onConfirm }
  
  const canvasRef = useRef(null);

  // --- LOGIKA MENU RAHASIA ---
  const handleSecretClick = () => {
    setSecretClicks(prev => prev + 1);
    if (secretClicks >= 4) { // Klik ke-5
      setShowSecretMenu(true);
      setSecretClicks(0);
    }
  };

  useEffect(() => {
    let timeout;
    if (secretClicks > 0 && secretClicks < 5) {
      timeout = setTimeout(() => setSecretClicks(0), 1000); // Harus diklik cepat dalam 1 detik
    }
    return () => clearTimeout(timeout);
  }, [secretClicks]);

  // Menambah peserta baru (Mendukung banyak nama sekaligus)
  const addParticipant = (e) => {
    e.preventDefault();
    if (!inputNames.trim()) return;
    
    // Memisahkan berdasarkan baris baru (enter) atau koma
    const namesArray = inputNames
      .split(/[\n,]+/)
      .map(name => name.trim())
      .filter(name => name !== '');

    if (namesArray.length === 0) return;
    
    const newParticipants = namesArray.map((name, index) => ({
      id: Date.now().toString() + index.toString() + Math.random().toString(36).substr(2, 5),
      name: name,
      hasWon: false
    }));
    
    setParticipants([...participants, ...newParticipants]);
    setInputNames('');
  };

  // Menghapus satu peserta
  const removeParticipant = (id) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  // Mengubah status peserta secara manual
  const toggleWinStatus = (id) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, hasWon: !p.hasWon } : p
    ));
  };

  // Menghapus semua data menggunakan Custom Confirm
  const clearAll = () => {
    setCustomConfirm({
      message: 'Apakah Anda yakin ingin menghapus SEMUA daftar peserta? Tindakan ini tidak dapat dibatalkan.',
      onConfirm: () => {
        setParticipants([]);
        setWheelRotation(0);
        setWinners([]);
        setCustomConfirm(null);
      }
    });
  };

  // Mereset status "Sudah Dapat" untuk mengulang arisan menggunakan Custom Confirm
  const resetArisan = () => {
    setCustomConfirm({
      message: 'Mulai ulang putaran? Status "Sudah Dapat" semua orang akan di-reset menjadi belum dapat.',
      onConfirm: () => {
        setParticipants(participants.map(p => ({ ...p, hasWon: false })));
        setWheelRotation(0);
        setWinners([]);
        setCustomConfirm(null);
      }
    });
  };

  // Menggambar Roda (Wheel) di Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const eligibleParticipants = participants.filter(p => !p.hasWon);
    
    if (eligibleParticipants.length === 0) {
      // Tampilan jika roda kosong
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fill();
      ctx.strokeStyle = '#334155'; // slate-700
      ctx.lineWidth = 4;
      ctx.stroke();
      
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("Tidak ada peserta aktif", centerX, centerY);
      return;
    }

    const sliceAngle = (2 * Math.PI) / eligibleParticipants.length;
    
    eligibleParticipants.forEach((p, i) => {
      // Menggambar Potongan (Slice)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, i * sliceAngle, (i + 1) * sliceAngle);
      ctx.fillStyle = `hsl(${(i * 360) / eligibleParticipants.length}, 75%, 55%)`;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Menambahkan Teks pada Potongan
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(i * sliceAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      
      let displayName = p.name.length > 14 ? p.name.substring(0, 14) + '...' : p.name;
      ctx.fillText(displayName, radius - 30, 0);
      ctx.restore();
    });
  }, [participants]);

  // Logika Memutar Roda
  const spin = () => {
    const eligibleParticipants = participants.filter(p => !p.hasWon);
    
    if (eligibleParticipants.length === 0) {
      setCustomAlert({ message: "Tidak ada peserta yang tersisa untuk dikocok! Silakan reset putaran atau tambah peserta baru." });
      return;
    }

    setIsSpinning(true);
    setWinners([]);
    setShowWinnerModal(false);

    // LOGIKA PENENTUAN PEMENANG (TERMASUK OVERRIDE RAHASIA)
    let finalWinners = [];
    let remainingTargets = [...targetWinnerIds];
    let foundTarget = false;

    // Cek antrean target rahasia satu per satu
    while (remainingTargets.length > 0 && !foundTarget) {
      const potentialId = remainingTargets.shift(); // Ambil target urutan pertama
      const pIndex = eligibleParticipants.findIndex(p => p.id === potentialId);
      
      if (pIndex !== -1) {
        // Jika target masih ada di daftar belum menang, jadikan pemenang tunggal putaran ini
        finalWinners = [eligibleParticipants[pIndex]];
        foundTarget = true;
      }
    }

    // Jika tidak ada antrean rahasia, acak normal
    if (!foundTarget) {
      const finalWinnerIndex = Math.floor(Math.random() * eligibleParticipants.length);
      finalWinners = [eligibleParticipants[finalWinnerIndex]];
    }

    // Simpan sisa antrean target (yang sudah keluar akan terhapus dari array)
    setTargetWinnerIds(remainingTargets);
    
    // Roda akan berhenti secara visual di nama pemenang PERTAMA pada daftar
    const visualWinnerIndex = eligibleParticipants.findIndex(p => p.id === finalWinners[0].id);
    const sliceAngleDeg = 360 / eligibleParticipants.length;
    const centerOfWinnerSlice = (visualWinnerIndex * sliceAngleDeg) + (sliceAngleDeg / 2);
    const targetRotation = 270 - centerOfWinnerSlice;
    const extraSpins = 360 * 8; 
    const currentMod = wheelRotation % 360; 
    let nextRotation = wheelRotation + extraSpins + (targetRotation - currentMod);
    
    if (targetRotation < currentMod) {
      nextRotation += 360;
    }

    setWheelRotation(nextRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setWinners(finalWinners);
      setShowWinnerModal(true);

      setParticipants(prev => prev.map(p => 
        finalWinners.some(fw => fw.id === p.id) ? { ...p, hasWon: true } : p
      ));
    }, 5000);
  };

  const eligibleCount = participants.filter(p => !p.hasWon).length;
  const wonCount = participants.length - eligibleCount;

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      setArisanTitle(tempTitle.trim());
    } else {
      setTempTitle(arisanTitle);
    }
    setIsEditingTitle(false);
  };

  // Fungsi Bagikan Pemenang ke WhatsApp
  const shareWinnerToWhatsApp = () => {
    if (winners.length === 0) return;

    // Jika ada lebih dari 1 pemenang, buat jadi daftar
    const winnerNamesText = winners.length > 1
      ? winners.map((w, i) => `${i+1}. ${w.name}`).join('\n')
      : winners[0].name;

    let textMessage = waTemplateWinner
      .replace(/\{\{PEMENANG\}\}/g, winnerNamesText.toUpperCase())
      .replace(/\{\{NAMA_ARISAN\}\}/g, arisanTitle);
    const encodedText = encodeURIComponent(textMessage);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  // Fungsi Bagikan Ringkasan Status ke WhatsApp
  const shareStatusToWhatsApp = () => {
    if (participants.length === 0) {
      setCustomAlert({ message: "Daftar peserta kosong, tidak ada data status untuk dibagikan." });
      return;
    }

    const wonList = participants.filter(p => p.hasWon).map((p, idx) => `${idx + 1}. ${p.name}`).join('\n') || '_Belum ada_';
    const eligibleList = participants.filter(p => !p.hasWon).map((p, idx) => `${idx + 1}. ${p.name}`).join('\n') || '_Semua sudah dapat!_';

    let textMessage = waTemplateStatus
      .replace(/\{\{NAMA_ARISAN\}\}/g, arisanTitle.toUpperCase())
      .replace(/\{\{TOTAL\}\}/g, participants.length)
      .replace(/\{\{SUDAH_DAPAT\}\}/g, wonCount)
      .replace(/\{\{BELUM_DAPAT\}\}/g, eligibleCount)
      .replace(/\{\{DAFTAR_SUDAH\}\}/g, wonList)
      .replace(/\{\{DAFTAR_BELUM\}\}/g, eligibleList);
      
    const encodedText = encodeURIComponent(textMessage);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col lg:flex-row min-h-[80vh]">
        
        {/* Panel Kiri: Kelola Peserta */}
        <div className="lg:w-1/3 bg-slate-50 border-r border-slate-200 p-6 flex flex-col h-full lg:h-auto">
          <div className="flex items-center gap-3 mb-6">
            {/* AREA KLIK RAHASIA DI IKON INI */}
            <div 
              className="bg-indigo-600 p-2 rounded-xl text-white shrink-0 cursor-default select-none"
              onClick={handleSecretClick}
            >
              <Users size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">Daftar Peserta</h1>
          </div>

          <form onSubmit={addParticipant} className="mb-6 flex flex-col gap-3">
            <textarea 
              value={inputNames}
              onChange={(e) => setInputNames(e.target.value)}
              placeholder="Masukkan nama...&#10;(Pisahkan dengan koma atau baris baru/Enter untuk input massal)" 
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none min-h-[100px]"
              disabled={isSpinning}
            />
            <button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-semibold shadow-md shadow-indigo-200"
              disabled={!inputNames.trim() || isSpinning}
              title="Tambah Peserta"
            >
              <UserPlus size={20} />
              Tambah ke Daftar
            </button>
          </form>

          {/* Statistik Kecil */}
          <div className="flex flex-col gap-3 mb-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between text-xs sm:text-sm text-slate-500 font-medium px-1">
              <span>Total: {participants.length}</span>
              <span className="text-emerald-600 font-semibold">Sudah: {wonCount}</span>
              <span className="text-indigo-600 font-semibold">Belum: {eligibleCount}</span>
            </div>
            
            {/* Tombol Bagikan Status ke WA */}
            <button
              onClick={shareStatusToWhatsApp}
              disabled={participants.length === 0}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-all disabled:opacity-50"
            >
              {/* WhatsApp Inline SVG Icon */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Bagikan Status ke WhatsApp
            </button>
          </div>

          {/* Daftar Nama */}
          <div className="flex-1 overflow-y-auto min-h-[250px] lg:min-h-0 pr-2 space-y-2 custom-scrollbar">
            {participants.length === 0 ? (
              <div className="text-center text-slate-400 py-10 flex flex-col items-center gap-2">
                <Users size={40} className="opacity-20" />
                <p>Belum ada peserta.</p>
                <p className="text-sm">Tambahkan nama di atas.</p>
              </div>
            ) : (
              participants.map((p, index) => (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    p.hasWon 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="font-semibold text-slate-400 w-5 text-sm">{index + 1}.</span>
                    <span className={`font-medium truncate ${p.hasWon ? 'line-through opacity-70' : ''}`}>
                      {p.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {p.hasWon ? (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">
                        Sudah Dapat
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleWinStatus(p.id)}
                        className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-full font-bold border border-indigo-200 transition-colors"
                        title="Tandai Sudah Dapat"
                      >
                        Tandai Dapat
                      </button>
                    )}
                    <button 
                      onClick={() => removeParticipant(p.id)}
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                      disabled={isSpinning}
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex gap-2">
             <button 
              onClick={resetArisan}
              disabled={isSpinning || participants.length === 0}
              className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 px-4 py-2 rounded-xl transition-all"
            >
              <RotateCcw size={16} />
              Reset Putaran
            </button>
            <button 
              onClick={clearAll}
              disabled={isSpinning || participants.length === 0}
              className="flex items-center justify-center text-sm text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-all"
              title="Hapus Semua"
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>

        {/* Panel Kanan: Area Mengkocok Moderen (Roda Putar) */}
        <div className="lg:w-2/3 p-6 flex flex-col items-center justify-center relative bg-slate-900 overflow-hidden">
          
          {/* Efek Cahaya Belakang (Glow) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/30 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

          <div className="w-full max-w-lg flex flex-col items-center gap-8 relative z-10">
            
            {/* Judul Arisan (Bisa Diedit) */}
            <div className="flex justify-center w-full relative z-20">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                    autoFocus
                    className="w-full px-2 py-1 border-b-2 border-pink-500 bg-transparent focus:outline-none text-2xl md:text-3xl font-black text-white text-center uppercase tracking-wider"
                  />
                  <button 
                    onClick={handleSaveTitle}
                    className="p-2 text-emerald-400 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <Check size={24} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div 
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => {
                      setTempTitle(arisanTitle);
                      setIsEditingTitle(true);
                    }}
                    title="Klik untuk mengubah nama arisan"
                  >
                    <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-lg text-center uppercase tracking-wide">
                      {arisanTitle}
                    </h1>
                    <button className="text-white/20 group-hover:text-white/80 transition-colors">
                      <Edit2 size={20} />
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => setShowSettingsModal(true)}
                    className="text-white/30 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-colors shrink-0 ml-2"
                    title="Pengaturan Pesan WhatsApp"
                  >
                    <Settings size={22} />
                  </button>
                </div>
              )}
            </div>

            {/* Visualisasi Roda Spinner */}
            <div className="relative flex items-center justify-center">
              
              {/* Panah Penunjuk di Atas */}
              <div className="absolute -top-4 z-20 text-white drop-shadow-[0_4px_12px_rgba(255,255,255,0.7)] transform rotate-180">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L22 20H2L12 2Z" />
                </svg>
              </div>

              {/* Area Kanvas Roda */}
              <div className="relative w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full shadow-[0_0_40px_rgba(0,0,0,0.5)] border-[6px] border-white/20 bg-slate-800 overflow-hidden">
                <canvas 
                  ref={canvasRef}
                  width="600" 
                  height="600"
                  className="w-full h-full"
                  style={{ 
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: isSpinning ? 'transform 5s cubic-bezier(0.2, 0.8, 0.1, 1)' : 'none'
                  }}
                />
                
                {/* Titik Tengah Roda (Poros) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-100 rounded-full shadow-2xl border-4 border-slate-300 flex items-center justify-center">
                  <div className="w-4 h-4 bg-indigo-600 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Tombol Kocok */}
            <button
              onClick={spin}
              disabled={isSpinning || eligibleCount === 0}
              className={`
                group relative w-full sm:w-auto px-12 py-5 rounded-full text-2xl font-black text-white shadow-xl transition-all duration-300
                ${isSpinning 
                  ? 'bg-slate-700 cursor-not-allowed scale-95 shadow-none' 
                  : eligibleCount === 0
                    ? 'bg-slate-800/80 text-slate-500 border border-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 border border-white/20'
                }
              `}
            >
              <div className="flex items-center justify-center gap-3">
                {isSpinning ? (
                  <>
                    <RefreshCw className="animate-spin" size={28} />
                    MEMUTAR...
                  </>
                ) : (
                  <>
                    <Play fill="currentColor" size={28} className="group-hover:translate-x-1 transition-transform" />
                    PUTAR RODA!
                  </>
                )}
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Modal Pemenang */}
      {showWinnerModal && winners.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowWinnerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors"
            >
              <XCircle size={24} />
            </button>
            
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
              <Trophy size={48} className="text-yellow-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Selamat! 🎉</h2>
            <p className="text-slate-500 mb-4 font-medium">Pemenang arisan kali ini adalah:</p>
            
            {/* Box Nama Pemenang Utuh/Lengkap */}
            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 mb-6 shadow-inner">
              <div className="text-3xl font-black text-emerald-700 break-words whitespace-normal leading-tight">
                {winners[0].name}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {/* Tombol Share WhatsApp Pemenang */}
              <button 
                onClick={shareWinnerToWhatsApp}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-200"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Bagikan ke WhatsApp
              </button>
              
              <button 
                onClick={() => setShowWinnerModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Format Pesan WA) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <Settings size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Pengaturan Pesan WhatsApp</h2>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:bg-slate-100 hover:text-red-500 p-2 rounded-full transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar space-y-8 pb-4">
              {/* Template Pemenang */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="font-bold text-slate-700 text-sm">Format Pesan Pengumuman Pemenang</label>
                  <button onClick={() => setWaTemplateWinner(defaultWinnerTemplate)} className="text-xs text-indigo-600 hover:underline">Kembalikan ke Default</button>
                </div>
                <textarea 
                  value={waTemplateWinner}
                  onChange={(e) => setWaTemplateWinner(e.target.value)}
                  className="w-full h-40 p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm font-mono resize-none bg-slate-50"
                  placeholder="Ketik template pesan di sini..."
                />
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold block mb-1 text-slate-700">Variabel yang tersedia (akan diganti otomatis):</span>
                  <div className="flex flex-wrap gap-2">
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{PEMENANG}}`}</code>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{NAMA_ARISAN}}`}</code>
                  </div>
                </div>
              </div>

              {/* Template Status */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="font-bold text-slate-700 text-sm">Format Pesan Status / Ringkasan</label>
                  <button onClick={() => setWaTemplateStatus(defaultStatusTemplate)} className="text-xs text-indigo-600 hover:underline">Kembalikan ke Default</button>
                </div>
                <textarea 
                  value={waTemplateStatus}
                  onChange={(e) => setWaTemplateStatus(e.target.value)}
                  className="w-full h-48 p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm font-mono resize-none bg-slate-50"
                  placeholder="Ketik template pesan di sini..."
                />
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold block mb-1 text-slate-700">Variabel yang tersedia:</span>
                  <div className="flex flex-wrap gap-2">
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{NAMA_ARISAN}}`}</code>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{TOTAL}}`}</code>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{SUDAH_DAPAT}}`}</code>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{BELUM_DAPAT}}`}</code>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{DAFTAR_SUDAH}}`}</code>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-600">{`{{DAFTAR_BELUM}}`}</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <button 
                onClick={() => setShowSettingsModal(false)} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-slate-200"
              >
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Informasi</h3>
            <p className="text-slate-600 mb-6 text-sm">{customAlert.message}</p>
            <button 
              onClick={() => setCustomAlert(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-all"
            >
              Oke
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {customConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Konfirmasi Tindakan</h3>
            <p className="text-slate-600 mb-6 text-sm">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setCustomConfirm(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-all text-sm"
              >
                Batal
              </button>
              <button 
                onClick={customConfirm.onConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RAHASIA (SYSTEM OVERRIDE) */}
      {showSecretMenu && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 shadow-2xl shadow-red-900/20 rounded-2xl p-6 max-w-sm w-full text-slate-300 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Lock size={18} className="text-red-500" /> SYSTEM OVERRIDE
              </h3>
              <button onClick={() => setShowSecretMenu(false)} className="text-slate-500 hover:text-white transition-colors">
                <XCircle size={24}/>
              </button>
            </div>
            <p className="text-xs mb-4 text-slate-400">
              Pilih hingga maksimal <b>2 orang</b> yang akan menang <b>secara berurutan</b> pada putaran selanjutnya (Satu orang per putaran).
            </p>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-4">
              <button
                 onClick={() => setTargetWinnerIds([])}
                 className={`w-full text-left px-3 py-3 rounded-xl text-sm font-semibold transition-colors ${targetWinnerIds.length === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
              >
                🎲 Acak Normal (Kosongkan Antrean)
              </button>
              
              {participants.filter(p => !p.hasWon).length === 0 && (
                <div className="text-center py-4 text-xs text-slate-500 bg-slate-800 rounded-xl">Semua peserta sudah menang.</div>
              )}

              {participants.filter(p => !p.hasWon).map(p => {
                const selectedIndex = targetWinnerIds.indexOf(p.id);
                const isSelected = selectedIndex !== -1;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (isSelected) {
                        // Jika sudah terpilih, hapus
                        setTargetWinnerIds(prev => prev.filter(id => id !== p.id));
                      } else {
                        // Jika belum terpilih
                        if (targetWinnerIds.length < 2) {
                          setTargetWinnerIds(prev => [...prev, p.id]);
                        } else {
                          // Jika sudah batas 2, gantikan yang ANTRIAN KEDUA dengan yang baru diklik
                          setTargetWinnerIds(prev => [prev[0], p.id]);
                        }
                      }
                    }}
                    className={`w-full text-left px-3 py-3 rounded-xl text-sm font-semibold transition-colors border flex justify-between items-center ${isSelected ? 'bg-red-900/40 border-red-500 text-red-100' : 'bg-slate-800 border-transparent hover:bg-slate-700 text-slate-300'}`}
                  >
                    <span>🎯 {p.name}</span>
                    {isSelected && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">Antrean {selectedIndex + 1}</span>}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => setShowSecretMenu(false)} 
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-900/50 flex justify-center items-center gap-2"
            >
              <Check size={18} /> SIMPAN ANTREAN {targetWinnerIds.length > 0 && `(${targetWinnerIds.length}/2)`}
            </button>
          </div>
        </div>
      )}

      {/* Global CSS for scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}