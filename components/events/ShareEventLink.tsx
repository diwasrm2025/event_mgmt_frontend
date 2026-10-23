"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faCheck, faShareNodes } from "@fortawesome/free-solid-svg-icons";
export function ShareEventLink() {
 const [copied, setCopied] = useState(false);
 const [fallback, setFallback] = useState("");
 async function copy() {
  try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setFallback(""); }
  catch { setFallback(window.location.href); }
 }
 return <aside className="event-share-callout" aria-label="Share this event"><FontAwesomeIcon icon={faShareNodes} /><div><strong>Better with your friends</strong><p>Copy the event link and share it with your friends.</p>{fallback && <><label htmlFor="share-event-url">Select and copy this link:</label><input id="share-event-url" readOnly value={fallback} onFocus={e => e.target.select()} autoFocus /></>}</div><button type="button" className="btn btn-accent" onClick={() => void copy()}><FontAwesomeIcon icon={copied ? faCheck : faCopy} />{copied ? "Link copied!" : "Copy event link"}</button><span className="sr-only" role="status">{copied ? "Event link copied. Share it with your friends." : ""}</span></aside>;
}
