import heic2any from 'heic2any';

/**
 * Servicio de utilidad optimizado para procesar imágenes.
 * Usa createObjectURL en lugar de FileReader para no colapsar la RAM del móvil.
 */
export const compressImage = async (file: File, maxWidth = 1200, quality = 0.8): Promise<string> => {
    let fileToProcess: File | Blob = file;

    // 1. Detectar si es una imagen nativa de Apple (.HEIC o .HEIF)
    const fileName = file.name ? file.name.toLowerCase() : '';
    if (file.type === 'image/heic' || file.type === 'image/heif' || fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
        try {
            // Ceder control al navegador un instante antes de que el conversor sature la CPU
            await new Promise(resolve => setTimeout(resolve, 50));
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: quality
            });
            fileToProcess = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        } catch (error) {
            console.error("Error convirtiendo formato HEIC a JPEG:", error);
            throw new Error("No se pudo procesar la foto del iPhone.");
        }
    }

    // 2. Proceso optimizado de compresión por Canvas
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        // createObjectURL es instantáneo y evita cargar megabytes en texto en la memoria RAM
        const objectUrl = URL.createObjectURL(fileToProcess);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl); // Liberar memoria inmediatamente
            
            // Forzar una pausa asíncrona para que la pantalla del móvil no se congele
            setTimeout(() => {
                try {
                    const elem = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = height * (maxWidth / width);
                        width = maxWidth;
                    }

                    elem.width = width;
                    elem.height = height;

                    const ctx = elem.getContext('2d');
                    if (!ctx) {
                        reject(new Error("No se pudo obtener el contexto del canvas"));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = elem.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                } catch (e) {
                    reject(e);
                }
            }, 50); // 50ms son suficientes para engañar al navegador y que no lance el error de "No responde"
        };
        
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
        
        img.src = objectUrl;
    });
};
