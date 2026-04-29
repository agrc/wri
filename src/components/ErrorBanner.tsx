import { Banner } from '@ugrc/utah-design-system/src/components/Banner';
import { Button } from '@ugrc/utah-design-system/src/components/Button';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

type Props = {
  message: string | null | undefined;
  onDismiss?: () => void;
};

export const ErrorBanner = ({ message, onDismiss }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [message]);

  if (!message) return null;

  return (
    <Banner className="m-0 my-2 max-w-full gap-0">
      <div className="flex items-start justify-between gap-2">
        <span ref={ref}>{message}</span>
        {onDismiss && (
          <Button variant="icon" aria-label="Dismiss error" className="-mr-2 -mt-1" onPress={onDismiss}>
            <X size={20} />
          </Button>
        )}
      </div>
    </Banner>
  );
};
