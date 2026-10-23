"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
export function EventRegistrationQr({ url }: { url: string }) {
 const [image, setImage] = useState(""); const [error, setError] = useState("");
 useEffect(() => { let active = true; QRCode.toDataURL(url, { width: 320, margin: 4, errorCorrectionLevel: "M" }).then(value => { if (active) setImage(value); }).catch(() => { if (active) setError("Could not generate QR code."); }); return () => { active = false; }; }, [url]);
 return <section className="panel" style={{ padding: 20 }}><h3>Event registration QR code</h3>{image && <><img src={image} alt="Scan to open event registration" width={240} height={240} /><p><a className="btn btn-ghost" href={image} download="event-registration-qr.png">Download QR code</a></p></>}{error && <p role="alert">{error}</p>}</section>;
}
