import { watch } from '@arcgis/core/core/reactiveUtils';
import { useViewUiPosition } from '@ugrc/utilities/hooks';
import { Redo2Icon, Undo2Icon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ImmerReducer } from 'use-immer';
import { useImmerReducer } from 'use-immer';
import { MapButton } from './MapButton';

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

  return (
    <div ref={uiPosition}>
      <MapButton
        IconComponent={Undo2Icon}
        label="Go to previous map extent"
        isDisabled={backwardIsDisabled}
        className="border-b-[1px] border-b-[#6e6e64d]"
        onPress={() => dispatch({ type: 'back' })}
      />
      <MapButton
        IconComponent={Redo2Icon}
        label="Go to next map extent"
        isDisabled={forwardIsDisabled}
        onPress={() => dispatch({ type: 'forward' })}
      />
    </div>
  );
};
