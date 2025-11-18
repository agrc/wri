import type { JSX, ReactNode } from 'react';
import { GridListItem, type GridListItemRenderProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import { composeTailwindRenderProps } from './utils';

const classes = tv({
  base: 'relative flex transform-gpu flex-col gap-y-2 rounded-md px-2 py-1 transition',
  variants: {
    isSelected: {
      true: 'selected:scale-105 selected:ring-2 selected:ring-inset selected:ring-secondary-600 selected:focus:ring-2 selected:focus:ring-accent-300 dark:selected:ring-primary-600 dark:selected:focus:ring-accent-300',
      false: '',
    },
    isFocusVisible: {
      true: 'focus:outline-0 focus:ring-2 focus:ring-accent-300 focus:ring-offset-0',
      false: '',
    },
  },
});

const renderItemClass = (values?: GridListItemRenderProps & { defaultClassName?: string | undefined }) => {
  const defaultClassName = values?.defaultClassName as string | undefined;
  const isSelected = !!values?.isSelected;
  const isFocusVisible = !!values?.isFocusVisible;
  const tvProps = {
    isSelected,
    isFocusVisible,
    className: defaultClassName,
  };

  return classes(tvProps);
};

const gridItemClassName = composeTailwindRenderProps(renderItemClass, '');

export type FeatureCardProps = {
  itemId: string;
  title?: string | nullish;
  size?: string | nullish;
  controls?: JSX.Element | null;
  children?: ReactNode;
};

export const FeatureCard = ({ itemId, title, size, controls, children }: FeatureCardProps) => {
  return (
    <GridListItem id={itemId} className={gridItemClassName} textValue={title ?? undefined}>
      <div>
        <div className="flex justify-between">
          <p className="font-bold">{title}</p>
          {size && (
            <span
              className="flex-none self-start whitespace-nowrap rounded border px-1 py-0.5 text-xs dark:border-zinc-600"
              aria-label="Feature size"
            >
              {size}
            </span>
          )}
        </div>
        {children}
      </div>
      {controls}
    </GridListItem>
  );
};

export default FeatureCard;
