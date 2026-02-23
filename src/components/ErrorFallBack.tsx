import { getErrorMessage, type FallbackProps } from 'react-error-boundary';

export const ErrorFallback = ({ error }: FallbackProps) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre className="text-red-700">{getErrorMessage(error)}</pre>
    </div>
  );
};
