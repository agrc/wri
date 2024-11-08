import ContentLoader, { IContentLoaderProps } from 'react-content-loader';

export const TagGroupLoader = ({ width = 200, height = 70, ...props }: IContentLoaderProps) => {
  return (
    <ContentLoader viewBox="0 0 200 70" height={height} width={width} {...props}>
      <rect x="10" y="10" rx="3" ry="3" width="40" height="10" />
      <rect x="60" y="10" rx="3" ry="3" width="70" height="10" />
      <rect x="140" y="10" rx="3" ry="3" width="20" height="10" />
      <rect x="10" y="30" rx="3" ry="3" width="90" height="10" />
      <rect x="110" y="30" rx="3" ry="3" width="70" height="10" />
      <rect x="10" y="50" rx="3" ry="3" width="70" height="10" />
      <rect x="90" y="50" rx="3" ry="3" width="60" height="10" />
    </ContentLoader>
  );
};
