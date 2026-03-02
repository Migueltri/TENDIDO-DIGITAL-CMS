
/**
 * Servicio de utilidad para procesar imágenes antes de subirlas.
 * Reduce el tamaño y la calidad para optimizar el rendimiento de GitHub API.
 */

export const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            
            img.onload = () => {
                const elem = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calcular nuevas dimensiones manteniendo ratio
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

                // Convertir a JPEG comprimido (Base64)
                const dataUrl = elem.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
