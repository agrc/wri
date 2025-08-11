import { watch } from '@arcgis/core/core/reactiveUtils';
import { Button } from '@ugrc/utah-design-system';
import { useViewUiPosition } from '@ugrc/utilities/hooks';
import { clsx } from 'clsx';
import type { WritableDraft } from 'immer';
import { Redo2Icon, Undo2Icon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useImmerReducer } from 'use-immer';

type State = {
  history: WritableDraft<__esri.Extent>[];
  index: number;
};

type Action =
  | {
      type: 'back' | 'forward';
    }
  | {
      type: 'history';
      payload: __esri.Extent;
    };

const initialState: State = {
  history: [],
  index: 0,
};

function reducer(draft: State, action: Action) {
  switch (action.type) {
    case 'back':
      draft.index = draft.index - 1;

      break;
    case 'forward':
      draft.index = draft.index + 1;

      break;
    case 'history':
      draft.history.splice(draft.index + 1, Infinity, action.payload);
      draft.index = draft.history.length - 1;

      break;
  }
}

export const NavigationHistory = ({
  view,
  position,
}: {
  view: __esri.MapView;
  position?: __esri.UIAddComponent['position'];
}) => {
  const uiPosition = useViewUiPosition(view, position ?? 'top-left');
  const [state, dispatch] = useImmerReducer(reducer, initialState);
  const isButtonExtentChange = useRef<boolean>(false);

  useEffect(() => {
    const handle = watch(
      () => [view.stationary, view.extent],
      ([stationary]) => {
        if (!stationary) return;

        // prevent infinite loop
        if (isButtonExtentChange.current) {
          isButtonExtentChange.current = false;

          return;
        }

        dispatch({
          type: 'history',
          payload: view.extent,
        });
      },
    );

    return () => {
      handle.remove();
    };
  }, [dispatch, view]);

  useEffect(() => {
    if (view && state.history[state.index]) {
      isButtonExtentChange.current = true; // prevent infinite loop
      view.goTo(state.history[state.index]);
    }
  }, [state, view]);

  const backwardIsDisabled = state.index === 0;
  const forwardIsDisabled = state.index >= state.history.length - 1;
  const iconClasses =
    'dark:text-[#9e9e9e] size-5 stroke-[1.5] transition-colors duration-150 ease-in-out will-change-transform group-enabled/button:[#6e6e6e] group-enabled/button:group-hover/button:text-[#151515] dark:group-enabled/button:group-hover/button:text-white group-disabled/button:[#cfcfcf] group-disabled/button:opacity-50';
  const buttonContainerClasses =
    'group/icon flex size-[32px] items-center justify-center bg-white dark:bg-zinc-800 dark:ring-white/10 shadow-[0_1px_2px_#0000004d]';
  const buttonClasses =
    'group/button size-full stroke-[4] p-0 transition-colors duration-150 ease-in-out will-change-transform focus:min-h-0 focus:outline-offset-[-2px] group/icon-hover:bg-[#f3f3f3]';

  return (
    <div ref={uiPosition}>
      <div className={clsx(buttonContainerClasses, 'border-b-[1px] border-b-[#6e6e6e4d]')}>
        <Button
          variant="icon"
          className={buttonClasses}
          aria-label="Go to previous map extent"
          onPress={() => dispatch({ type: 'back' })}
          isDisabled={backwardIsDisabled}
        >
          <Undo2Icon className={iconClasses} aria-hidden />
          <span className="sr-only">Go to previous map extent</span>
        </Button>
      </div>
      <div className={buttonContainerClasses}>
        <Button
          variant="icon"
          className={buttonClasses}
          aria-label="Go to next map extent"
          onPress={() => dispatch({ type: 'forward' })}
          isDisabled={forwardIsDisabled}
        >
          <Redo2Icon className={iconClasses} aria-hidden />
          <span className="sr-only">Go to next map extent</span>
        </Button>
      </div>
    </div>
  );
};
