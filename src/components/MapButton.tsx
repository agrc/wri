import '@esri/calcite-components/components/calcite-button';
import { clsx } from 'clsx';
import { forwardRef, useEffect, useRef } from 'react';

type MapButtonProps = {
  IconComponent: React.ElementType;
  label: string;
  isDisabled?: boolean;
  className?: string;
  onPress?: () => void;
  slot?: string;
};

const iconClasses = 'pointer-events-none size-5 stroke-[1.75]';
const buttonContainerClasses =
  'flex size-8 items-center justify-center overflow-hidden bg-white shadow-[0_1px_2px_#0000004d]';
const buttonClasses = 'size-full';

const buttonStyle = {
  '--calcite-button-background-color': '#ffffff',
  '--calcite-button-border-color': 'transparent',
  '--calcite-button-corner-radius': '0',
  '--calcite-button-shadow': 'none',
  '--calcite-button-text-color': '#4a4a4a',
  '--calcite-button-text-color-hover': '#151515',
} as React.CSSProperties;

export const MapButton = forwardRef<HTMLDivElement, MapButtonProps>(function MapButton(
  { IconComponent, label, isDisabled, className, onPress, slot },
  ref,
) {
  const buttonRef = useRef<HTMLCalciteButtonElement | null>(null);

  useEffect(() => {
    const button = buttonRef.current;

    if (!button || !onPress) {
      return;
    }

    const handleClick = () => {
      if (!button.disabled) {
        onPress();
      }
    };

    button.addEventListener('click', handleClick);

    return () => {
      button.removeEventListener('click', handleClick);
    };
  }, [onPress]);

  return (
    <div className={clsx(buttonContainerClasses, className)} ref={ref} slot={slot}>
      <calcite-button
        ref={buttonRef}
        appearance="solid"
        kind="neutral"
        scale="s"
        width="auto"
        className={buttonClasses}
        disabled={isDisabled}
        label={label}
        title={label}
        style={buttonStyle}
      >
        <span className="flex size-full items-center justify-center">
          <IconComponent className={clsx(iconClasses, isDisabled ? 'text-zinc-400' : 'text-zinc-700')} aria-hidden />
        </span>
      </calcite-button>
    </div>
  );
});
