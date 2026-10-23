import { Swal } from './swal';
export function qrFilename(title: string) { return (title.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'qr-code') + '.png'; }
export async function downloadQr(title: string, url: string) {
 const decision = await Swal.fire({ title: 'Download QR code?', text: 'Do you want this link as a QR code?', icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, download', cancelButtonText: 'Cancel' });
 if (!decision.isConfirmed) return;
 const QRCode = await import('qrcode');
 const image = await QRCode.toDataURL(url, { width: 640, margin: 4, errorCorrectionLevel: 'M' });
 const link = document.createElement('a'); link.href = image; link.download = qrFilename(title); link.click();
}
