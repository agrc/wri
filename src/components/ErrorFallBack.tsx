export const ErrorFallback = ({ error }: { error: Error }) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre className="text-red-700">{error.message}</pre>
    </div>
  );
};
