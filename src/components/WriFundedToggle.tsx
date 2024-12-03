import { Switch } from '@ugrc/utah-design-system';
import { useContext } from 'react';
import { FilterContext } from './contexts';

export const WriFundingToggle = () => {
  const { dispatch, wriFunding } = useContext(FilterContext);

  return (
    <div>
      <Switch
        aria-label="Toggle WRI funded projects"
        isSelected={wriFunding}
        onChange={(value) => {
          dispatch({
            type: 'set',
            payload: value,
            metadata: 'wriFunding',
          });
        }}
      >
        Funded by WRI
      </Switch>
      <p className="pt-0.5 text-sm italic text-zinc-600 dark:text-zinc-400">
        Displaying {wriFunding ? 'WRI funded projects' : 'all project'}.
      </p>
    </div>
  );
};
