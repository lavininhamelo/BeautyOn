import React from 'react';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  name: string;
  src?: string | null | undefined;
  backgroundColor?: string;
};

function dicebearInitialsUrl(name: string, backgroundColor: string): string {
  const seed = encodeURIComponent(name || 'User');
  const bg = encodeURIComponent(backgroundColor.replace('#', ''));
  return `https://api.dicebear.com/7.x/initials/svg?backgroundColor=ffd2e4&&seed=${seed}&backgroundType=solid&backgroundColor=${bg}`;
}

const Avatar: React.FC<Props> = ({
  name,
  src,
  backgroundColor = 'E4A0BC',
  alt = '',
  ...rest
}) => {
  const resolvedSrc = src || dicebearInitialsUrl(name, backgroundColor);
  return <img src={resolvedSrc} alt={alt} {...rest} />;
};

export default Avatar;

