import { watch } from '@arcgis/core/core/reactiveUtils';
import { Button } from '@ugrc/utah-design-system';
import { useViewUiPosition } from '@ugrc/utilities/hooks';
import { clsx } from 'clsx';
import { Redo2Icon, Undo2Icon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ImmerReducer } from 'use-immer';
import { useImmerReducer } from 'use-immer';

const MAX_HISTORY = 50;
const EPS = 1e-4;

type MinimalExtent = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference?: { wkid?: number | null };
};

const extentsEqual = (a?: MinimalExtent, b?: MinimalExtent) => {
  if (!a || !b) {
    return false;
  }

  return (
    Math.abs(a.xmin - b.xmin) < EPS &&
    Math.abs(a.ymin - b.ymin) < EPS &&
    Math.abs(a.xmax - b.xmax) < EPS &&
    Math.abs(a.ymax - b.ymax) < EPS &&
    a.spatialReference?.wkid === b.spatialReference?.wkid
  );
};

type State = {
  history: __esri.Extent[];
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

const reducer: ImmerReducer<State, Action> = (draft, action) => {
  switch (action.type) {
    case 'back': {
      draft.index = Math.max(0, draft.index - 1);
      break;
    }
    case 'forward': {
      draft.index = Math.min(draft.history.length - 1, draft.index + 1);
      break;
    }
    case 'history': {
      const incoming = action.payload;
      const current = draft.history[draft.index];
      // De-duplicate consecutive extents
      if (current && extentsEqual(current, incoming)) {
        break;
      }

      // Truncate forward history and append new extent
      draft.history.splice(draft.index + 1, Infinity, incoming);
      draft.index = draft.history.length - 1;

      // Cap history length
      if (draft.history.length > MAX_HISTORY) {
        draft.history.shift();
        draft.index = Math.max(0, draft.index - 1);
      }

      break;
    }
  }
};

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

  // Seed the initial extent once
  useEffect(() => {
    if (view?.extent) {
      dispatch({ type: 'history', payload: view.extent.clone() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    const handle = watch(
      () => [view.stationary, view.extent],
      ([stationary]) => {
        if (!stationary) {
          return;
        }

        // Skip additions triggered by programmatic goTo
        if (isButtonExtentChange.current) {
          return;
        }

        dispatch({
          type: 'history',
          payload: view.extent.clone(),
        });
      },
    );

    return () => {
      handle.remove();
    };
  }, [dispatch, view]);

  useEffect(() => {
    const target = state.history[state.index];

    if (view && target) {
      isButtonExtentChange.current = true; // prevent infinite loop
      Promise.resolve(view.goTo(target))
        .catch(() => {})
        .finally(() => {
          isButtonExtentChange.current = false;
        });
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
      <div className={clsx(buttonContainerClasses, 'border-b-[1px] border-b-[#6e6e64d]')}>
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
