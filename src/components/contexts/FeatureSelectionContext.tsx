import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { serializeFeatureKey, type FeatureSelectionIdentity, type SelectedFeature } from '../featureSelection';

type FeatureSelectionResolver = (selection: FeatureSelectionIdentity) => SelectedFeature | null;
export type FeatureSelectionOrigin = 'list' | 'map';

type FeatureSelectionContextType = {
  selectedFeatureIdentity: FeatureSelectionIdentity | null;
  selectedFeatureKey: string | null;
  selectedFeature: SelectedFeature | null;
  selectionOrigin: FeatureSelectionOrigin | null;
  selectFeature: (selection: FeatureSelectionIdentity, origin?: FeatureSelectionOrigin) => SelectedFeature | null;
  clearSelection: () => void;
  registerResolver: (resolver: FeatureSelectionResolver | null) => void;
  isMapSelectionEnabled: boolean;
  setMapSelectionEnabled: (enabled: boolean) => void;
};

const FeatureSelectionContext = createContext<FeatureSelectionContextType | null>(null);

export const useFeatureSelection = () => {
  const context = useContext(FeatureSelectionContext);
  if (!context) {
    throw new Error('useFeatureSelection must be used within a FeatureSelectionProvider');
  }
  return context;
};

type FeatureSelectionProviderProps = {
  children: ReactNode;
};

export const FeatureSelectionProvider = ({ children }: FeatureSelectionProviderProps) => {
  const resolverRef = useRef<FeatureSelectionResolver | null>(null);
  const selectedFeatureIdentityRef = useRef<FeatureSelectionIdentity | null>(null);
  const [selectedFeatureIdentity, setSelectedFeatureIdentity] = useState<FeatureSelectionIdentity | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [selectionOrigin, setSelectionOrigin] = useState<FeatureSelectionOrigin | null>(null);
  const [isMapSelectionEnabled, setMapSelectionEnabled] = useState(true);

  const clearSelection = useCallback(() => {
    selectedFeatureIdentityRef.current = null;
    setSelectedFeatureIdentity(null);
    setSelectedFeature(null);
    setSelectionOrigin(null);
  }, []);

  const registerResolver = useCallback((resolver: FeatureSelectionResolver | null) => {
    resolverRef.current = resolver;
  }, []);

  const selectFeature = useCallback(
    (selection: FeatureSelectionIdentity, origin: FeatureSelectionOrigin = 'list') => {
      const currentSelection = selectedFeatureIdentityRef.current;

      if (
        currentSelection?.projectId === selection.projectId &&
        currentSelection.kind === selection.kind &&
        currentSelection.id === selection.id
      ) {
        clearSelection();

        return null;
      }

      const resolved = resolverRef.current?.(selection) ?? null;

      if (!resolved) {
        clearSelection();

        return null;
      }

      selectedFeatureIdentityRef.current = selection;
      setSelectedFeatureIdentity(selection);
      setSelectedFeature(resolved);
      setSelectionOrigin(origin);

      return resolved;
    },
    [clearSelection],
  );

  return (
    <FeatureSelectionContext.Provider
      value={{
        selectedFeatureIdentity,
        selectedFeatureKey: selectedFeatureIdentity
          ? serializeFeatureKey(selectedFeatureIdentity.kind, selectedFeatureIdentity.id)
          : null,
        selectedFeature,
        selectionOrigin,
        selectFeature,
        clearSelection,
        registerResolver,
        isMapSelectionEnabled,
        setMapSelectionEnabled,
      }}
    >
      {children}
    </FeatureSelectionContext.Provider>
  );
};
