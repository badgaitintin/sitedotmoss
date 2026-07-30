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

  if (!images || images.length === 0) return null;

  const goTo = (idx: number) => {
    if (idx === currentIndex) return;
    setFading(true);
    setTimeout(() => {
      setCurrentIndex(idx);
      setFading(false);
    }, 180);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    goTo(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    goTo(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  };

  return (
    <div className="relative w-full h-full bg-black/5 flex items-center justify-center overflow-hidden select-none group" onDoubleClick={onDoubleTapLike}>
      {/* Image */}
      <img
        src={images[currentIndex]}
        alt={`${altText} ${currentIndex + 1}`}
        className={`w-full h-full object-contain transition-opacity duration-300 ${fading ? "opacity-0" : "opacity-100"}`}
      />

      {/* Counter badge */}
      {images.length > 1 && (
        <div className="absolute top-3 right-3 bg-white/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-zinc-900 border-t border-white shadow-sm flex items-center gap-1.5 z-10">
          <Layers size={12} />
          {currentIndex + 1}/{images.length}
        </div>
      )}

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-zinc-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border-t border-white shadow-md z-20"
            aria-label="Previous image"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 hover:bg-white text-zinc-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border-t border-white shadow-md z-20"
            aria-label="Next image"
          >
            <ChevronRight size={18} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); goTo(idx); }}
                className={`h-1.5 rounded-full transition-all border-none ${
                  idx === currentIndex ? "w-5 bg-zinc-900" : "w-1.5 bg-zinc-400/50 hover:bg-zinc-600"
                }`}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
