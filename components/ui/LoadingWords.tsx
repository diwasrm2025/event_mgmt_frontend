"use client";
import { useEffect, useState } from 'react';
export function LoadingWords({ label }: { label: string }) {
 const [index, setIndex] = useState(0);
 useEffect(() => { setIndex(0); const timer = window.setInterval(() => setIndex(value => (value + 1) % 3), 1800); return () => window.clearInterval(timer); }, [label]);
 const words = [label, 'Processing request', 'Waiting for the server'];
 return <span key={words[index]} className="progress-word">{words[index]}<span className="progress-dots" aria-hidden="true">...</span></span>;
}
