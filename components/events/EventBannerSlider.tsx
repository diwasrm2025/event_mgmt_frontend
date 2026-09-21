"use client";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

export function EventBannerSlider({ banners, title }: { banners: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const images = banners.filter(url => !failed.includes(url));
  if (!images.length) return null;
  const current = index % images.length;
  const url = images[current];
  const src = /^https?:\/\//i.test(url) ? url : `${getApiBaseUrl().replace(/\/api$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
  return <section className="event-banner-slider" aria-label={`${title} photos`} aria-roledescription="carousel">
    <img src={src} alt={`${title} - photo ${current + 1} of ${images.length}`} onError={() => setFailed(items => [...items, url])} />
    {images.length > 1 && <div className="event-banner-controls">
      <button className="btn btn-ghost btn-sm" type="button" aria-label="Previous event photo" onClick={() => setIndex((current + images.length - 1) % images.length)}>Previous</button>
      <span aria-live="polite">{current + 1} / {images.length}</span>
      <button className="btn btn-ghost btn-sm" type="button" aria-label="Next event photo" onClick={() => setIndex((current + 1) % images.length)}>Next</button>
    </div>}
  </section>;
}
