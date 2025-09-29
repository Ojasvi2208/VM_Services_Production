'use client';

import { ReactNode, useRef } from 'react';
import { motion, useInView, Variants } from 'framer-motion';

type AnimatedElementProps = {
  children: ReactNode;
  variant?: 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scale' | 'fadeIn';
  delay?: number;
  duration?: number;
  className?: string;
  threshold?: number;
  once?: boolean;
};

export default function AnimatedElement({
  children,
  variant = 'fadeUp',
  delay = 0,
  duration = 0.5,
  className = '',
  threshold = 0.15,
  once = true
}: AnimatedElementProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, amount: threshold });

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: variant === 'fadeUp' ? 30 : variant === 'fadeDown' ? -30 : 0,
      x: variant === 'fadeLeft' ? 30 : variant === 'fadeRight' ? -30 : 0,
      scale: variant === 'scale' ? 0.95 : 1
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: {
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1.0]
      }
    }
  };
  
  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}
