import React from 'react';

import logoMenuImg from '../../../assets/images/logotipico_primary.webp';

type Props = {
  title: string;
  backgroundImage?: string;
  animationFrom?: 'left' | 'right';
  authLogo?: 'menu' | 'signup';
  children: React.ReactNode;
};

const AuthLayout: React.FC<Props> = ({
  title,
  backgroundImage,
  animationFrom = 'left',
  authLogo = 'menu',
  children,
}) => {
  const logoSrc = logoMenuImg;

  return (
    <div className="flex min-h-screen items-stretch bg-[var(--color-background)]">
      <div className="flex w-full max-w-[700px] flex-col items-center justify-start px-4 py-5 sm:justify-center sm:py-8">
        <div
          style={{
            animation:
              animationFrom === 'left'
                ? 'appearLeft 1s ease-out forwards'
                : 'appearRight 1s ease-out forwards',
          }}
          className="flex w-full max-w-[400px] flex-col items-center sm:justify-center"
        >
          <div className="mb-3 shrink-0 px-4 sm:mb-5 sm:px-8">
            <img
              src={logoSrc}
              alt="BeautyOn"
              className="mx-auto h-[88px] w-auto max-h-[22vh] max-w-full shrink-0 object-contain sm:h-[120px] sm:max-h-none md:h-[140px]"
            />
          </div>
          <h1 className="sr-only">{title}</h1>
          <div className="auth-layout-inner w-full">{children}</div>
        </div>
      </div>
      <div
        className="hidden flex-1 bg-cover bg-right bg-no-repeat sm:block"
        style={
          backgroundImage
            ? { backgroundImage: `url(${backgroundImage})` }
            : undefined
        }
      />
    </div>
  );
};

export default AuthLayout;
