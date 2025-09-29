import React from 'react';

type ResponsiveContainerProps = {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: boolean;
};

export default function ResponsiveContainer({ 
  children, 
  className = '',
  maxWidth = 'xl',
  padding = true
}: ResponsiveContainerProps) {
  
  const maxWidthClasses = {
    'sm': 'max-w-screen-sm',
    'md': 'max-w-screen-md',
    'lg': 'max-w-screen-lg',
    'xl': 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    'full': 'max-w-full',
  };
  
  return (
    <div className={`
      ${padding ? 'container-padding' : ''}
      ${maxWidthClasses[maxWidth]} 
      mx-auto
      ${className}
    `}>
      {children}
    </div>
  );
}
