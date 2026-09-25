import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
}

export const Logo155UASU: React.FC<LogoProps> = ({
  className = 'h-14 w-14',
  size,
}) => {
  let sizeStyle: React.CSSProperties = {};
  if (typeof size === 'number') {
    sizeStyle = { width: size, height: size };
  }

  const getSizeClass = () => {
    if (typeof size === 'number') return '';
    if (size === 'sm') return 'h-8 w-8';
    if (size === 'md') return 'h-12 w-12';
    if (size === 'lg') return 'h-[84px] w-[84px]'; // 130% Scale (84px x 84px, 1.3x of base 64px) for login portal & headers
    if (size === 'xl') return 'h-24 w-24';
    if (size === '2xl') return 'h-32 w-32';
    return className;
  };

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none overflow-visible aspect-square transition-all duration-300 ${getSizeClass()}`}
      style={sizeStyle}
    >
      <img
        src="/155-uasu-baf-logo.png"
        alt="155 UASU BAF Crest"
        className="h-full w-full aspect-square object-contain drop-shadow-md"
      />
    </div>
  );
};
