'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface AnimatedBackgroundProps {
  images: string[];
  interval?: number;
  children: React.ReactNode;
  className?: string;
}

export default function AnimatedBackground({
  images,
  interval = 7000,
  children,
  className = '',
}: AnimatedBackgroundProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, interval);

    return () => clearInterval(timer);
  }, [images.length, interval]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background images */}
      {images.map((src, index) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-2000 ease-in-out ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ zIndex: 0 }}
        >
          <Image
            src={src}
            alt=""
            fill
            quality={90}
            priority={index === 0}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-hero" />
        </div>
      ))}
      
      {/* Foreground content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
