import { Button } from '@ugrc/utah-design-system';
import { clsx } from 'clsx';

type MapButtonProps = {
  IconComponent: React.ElementType;
  label: string;
  isDisabled?: boolean;
  className?: string;
  onPress?: () => void;
  ref?: React.Ref<HTMLDivElement>;
};

const iconClasses =
  'dark:text-[#9e9e9e] size-5 stroke-[1.5] transition-colors duration-150 ease-in-out will-change-transform group-enabled/button:[#6e6e6e] group-enabled/button:group-hover/button:text-[#151515] dark:group-enabled/button:group-hover/button:text-white group-disabled/button:[#cfcfcf] group-disabled/button:opacity-50';
const buttonContainerClasses =
  'group/icon flex size-[32px] items-center justify-center bg-white dark:bg-zinc-800 dark:ring-white/10 shadow-[0_1px_2px_#0000004d]';
const buttonClasses =
  'group/button size-full stroke-[4] p-0 transition-colors duration-150 ease-in-out will-change-transform focus:min-h-0 focus:outline-offset-[-2px] group/icon-hover:bg-[#f3f3f3]';

export function MapButton({ IconComponent, label, isDisabled, className, onPress, ref }: MapButtonProps) {
  return (
    <div className={clsx(buttonContainerClasses, className)} ref={ref}>
      <Button
        variant="icon"
        className={buttonClasses}
        aria-label={label}
        onPress={() => onPress && onPress()}
        isDisabled={isDisabled}
      >
        <IconComponent className={iconClasses} aria-hidden />
        <span className="sr-only">{label}</span>
      </Button>
    </div>
  );
}
