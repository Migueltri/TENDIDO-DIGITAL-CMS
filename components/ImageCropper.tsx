import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, Maximize } from 'lucide-react';

interface Props {
  imageSrc: string;
  onCropDone: (base64: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ imageSrc, onCropDone, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // aspect = undefined permite recorte libre. 4/5 es ideal para vertical.
  const [aspect, setAspect] = useState<number | undefined>(undefined); 
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const saveCrop = async () => {
    if (!croppedAreaPixels) return;
    try {
      const canvas = document.createElement('canvas');
      const image = new Image();
      image.src = imageSrc;
      await new Promise((resolve) => { image.onload = resolve; });

      // Redimensionar inteligentemente (Máximo 1200px) para no reventar la base de datos
      const MAX_WIDTH = 800;
      let finalWidth = croppedAreaPixels.width;
      let finalHeight = croppedAreaPixels.height;

      if (finalWidth > MAX_WIDTH || finalHeight > MAX_WIDTH) {
        if (finalWidth > finalHeight) {
          finalHeight = Math.round((finalHeight * MAX_WIDTH) / finalWidth);
          finalWidth = MAX_WIDTH;
        } else {
          finalWidth = Math.round((finalWidth * MAX_WIDTH) / finalHeight);
          finalHeight = MAX_WIDTH;
        }
      }

      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(
          image,
          croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height,
          0, 0, finalWidth, finalHeight
        );
        // Generamos la imagen ya comprimida lista para guardar
        onCropDone(canvas.toDataURL('image/jpeg', 0.5));
      }
    } catch (e) {
      console.error("Error al procesar la imagen:", e);
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col">
      {/* BARRA SUPERIOR DE CONTROLES */}
      <div className="flex justify-between items-center p-4 bg-black text-white shadow-md">
        <button onClick={onCancel} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition"><X size={20} /></button>
        
        <div className="flex gap-2 bg-gray-800 p-1 rounded-lg overflow-x-auto">
          <button onClick={() => setAspect(16/9)} className={`px-3 py-1 text-xs md:text-sm whitespace-nowrap rounded transition ${aspect === 16/9 ? 'bg-brand-red font-bold' : 'hover:bg-gray-700'}`}>Apaisado (16:9)</button>
          <button onClick={() => setAspect(3/4)} className={`px-3 py-1 text-xs md:text-sm whitespace-nowrap rounded transition ${aspect === 3/4 ? 'bg-brand-red font-bold' : 'hover:bg-gray-700'}`}>Vertical (3:4)</button>
          <button onClick={() => setAspect(9/16)} className={`px-3 py-1 text-xs md:text-sm whitespace-nowrap rounded transition ${aspect === 9/16 ? 'bg-brand-red font-bold' : 'hover:bg-gray-700'}`}>Vertical Móvil (9:16)</button>
          <button onClick={() => setAspect(undefined)} className={`px-3 py-1 text-xs md:text-sm whitespace-nowrap rounded transition ${aspect === undefined ? 'bg-brand-red font-bold' : 'hover:bg-gray-700'}`}>Libre</button>
        </div>

        <button onClick={saveCrop} className="p-2 bg-brand-red hover:bg-red-700 rounded-full text-white flex items-center gap-2 px-4 font-bold transition">
          <Check size={20} /> <span className="hidden md:inline">Confirmar</span>
        </button>
      </div>

      {/* ÁREA DE RECORTE */}
      <div className="relative flex-1 bg-black">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>

      {/* CONTROLES DE ZOOM */}
      <div className="p-6 bg-black flex justify-center items-center gap-4 border-t border-gray-800">
        <span className="text-gray-400 text-sm"><Maximize size={18}/></span>
        <input 
          type="range" value={zoom} min={1} max={3} step={0.1} 
          onChange={(e) => setZoom(Number(e.target.value))} 
          className="w-full max-w-md accent-brand-red cursor-pointer" 
        />
      </div>
    </div>
  );
}
