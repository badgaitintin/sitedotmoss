import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  altText: string;
  onDoubleTapLike?: () => void;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, altText, onDoubleTapLike }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (!images || images.length === 0) return null;

  const goTo = (idx: number) => {
    if (idx === currentIndex) return;
    setFading(true);
    setTimeout(() => { setCurrentIndex(idx); setFading(false); }, 180);
  };

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); goTo(currentIndex === 0 ? images.length - 1 : currentIndex - 1); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); goTo(currentIndex === images.length - 1 ? 0 : currentIndex + 1); };

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", userSelect: "none" }}
      onDoubleClick={onDoubleTapLike}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={images[currentIndex]}
        alt={`${altText} ${currentIndex + 1}`}
        style={{ width: "100%", height: "100%", objectFit: "contain", transition: "opacity 0.25s ease", opacity: fading ? 0 : 1 }}
      />

      {images.length > 1 && (
        <>
          {/* Counter */}
          <div style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(0,0,0,0.6)", color: "#fff",
            padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500,
            zIndex: 10, backdropFilter: "blur(4px)",
          }}>
            {currentIndex + 1}/{images.length}
          </div>

          {/* Multi icon */}
          <div style={{ position: "absolute", top: 12, right: 56, color: "#fff", zIndex: 10, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>
            <Layers size={16} />
          </div>

          {/* Prev */}
          {currentIndex > 0 && (
            <button
              onClick={prev}
              style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.85)", color: "#000",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: hovered ? 1 : 0, transition: "opacity 0.2s",
                border: "none", cursor: "pointer", zIndex: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
              aria-label="Previous"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          {/* Next */}
          {currentIndex < images.length - 1 && (
            <button
              onClick={next}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.85)", color: "#000",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: hovered ? 1 : 0, transition: "opacity 0.2s",
                border: "none", cursor: "pointer", zIndex: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>
          )}

          {/* Dots */}
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 4, zIndex: 20,
          }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); goTo(i); }}
                style={{
                  width: 6, height: 6, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                  background: i === currentIndex ? "#0095f6" : "rgba(255,255,255,0.4)",
                  transition: "all 0.2s",
                  transform: i === currentIndex ? "scale(1.3)" : "scale(1)",
                }}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
