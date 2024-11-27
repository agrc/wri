import { watch } from '@arcgis/core/core/reactiveUtils';
import { Button } from '@ugrc/utah-design-system';
import { useViewUiPosition } from '@ugrc/utilities/hooks';
import clsx from 'clsx';
import { WritableDraft } from 'immer';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
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
    if (!view?.extent) return;

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
  const commonIconClasses = 'size-5 stroke-[1.5] transition-colors duration-150 ease-in-out will-change-transform ';
  const enabledIconClasses = 'text-[#6e6e6e] group-hover:text-[#151515]';
  const disabledIconClasses = 'text-[#cfcfcf]';
  const buttonContainerClasses =
    'group flex size-[32px] items-center justify-center bg-white shadow-[0_1px_2px_#0000004d]';
  const buttonClasses =
    'size-full stroke-[4] p-0 transition-colors duration-150 ease-in-out will-change-transform focus:min-h-0 focus:outline-offset-[-2px] group-hover:bg-[#f3f3f3]';

  return (
    <div ref={uiPosition}>
      <div className={clsx(buttonContainerClasses, 'border-b-[1px] border-b-[#6e6e6e4d]')}>
        <Button
          variant="icon"
          className={buttonClasses}
          aria-label="Go Back"
          onPress={() => dispatch({ type: 'back' })}
          isDisabled={backwardIsDisabled}
        >
          <ChevronLeftIcon
            className={clsx(commonIconClasses, backwardIsDisabled ? disabledIconClasses : enabledIconClasses)}
            aria-hidden
          />
          <span className="sr-only">Go Back</span>
        </Button>
      </div>
      <div className={buttonContainerClasses}>
        <Button
          variant="icon"
          className={buttonClasses}
          aria-label="Go Forward"
          onPress={() => dispatch({ type: 'forward' })}
          isDisabled={forwardIsDisabled}
        >
          <ChevronRightIcon
            className={clsx(commonIconClasses, forwardIsDisabled ? disabledIconClasses : enabledIconClasses)}
            aria-hidden
          />
          <span className="sr-only">Go Forward</span>
        </Button>
      </div>
    </div>
  );
};
