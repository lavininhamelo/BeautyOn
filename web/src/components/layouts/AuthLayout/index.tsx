import React from 'react';

import LogoImg from '../../../assets/images/logo.png';

type Props = {
  title: string;
  backgroundImage?: string;
  animationFrom?: 'left' | 'right';
  children: React.ReactNode;
};

const AuthLayout: React.FC<Props> = ({
  title,
  backgroundImage,
  animationFrom = 'left',
  children,
}) => {
  return (
    <div className="flex min-h-screen items-stretch">
      <div className="flex w-full max-w-[700px] flex-col items-center justify-center">
        <div
          style={{
            animation:
              animationFrom === 'left'
                ? 'appearLeft 1s ease-out forwards'
                : 'appearRight 1s ease-out forwards',
          }}
          className="flex flex-col items-center justify-center"
        >
          <img
            src={LogoImg}
            alt="BeautyOn"
            className="h-[52px] w-auto max-w-[min(100%,180px)] shrink-0 object-contain sm:h-[60px] sm:max-w-[200px]"
          />
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
