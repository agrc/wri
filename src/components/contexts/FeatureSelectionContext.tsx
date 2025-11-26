import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Feature, PolygonFeature, PolygonFeatures } from '../ProjectSpecific';

type SelectedFeature = (Feature | PolygonFeature) & {
  kind: 'poly' | 'line' | 'point';
  // Computed display properties
  details?: string[]; // For poly: action/subtype/herbicide combinations
  isRetreatment?: boolean; // For poly retreatment status
};

type EnrichFeatureParams =
  | { kind: 'poly'; feature: PolygonFeature; polygons: PolygonFeatures }
  | { kind: 'line'; feature: Feature }
  | { kind: 'point'; feature: Feature };

// Transform feature data into enriched format
const enrichFeature = (params: EnrichFeatureParams): SelectedFeature => {
  const { kind } = params;

  if (kind === 'poly') {
    const { feature, polygons } = params;
    const polyGroup = Object.values(polygons).find((group) => group[0]?.id === feature.id);
    const polyDetails =
      polyGroup
        ?.map((pt) => [pt?.action, pt?.subtype, pt?.herbicide].filter(Boolean).join(' - '))
        .filter((line) => line.length > 0) ?? [];
    const isRetreatment = feature.retreatment?.toUpperCase() === 'Y';

    return {
      ...feature,
      kind,
      details: polyDetails,
      isRetreatment,
    };
  }

  if (kind === 'line') {
    const { feature } = params;
    const lineDetails = [feature.action, feature.subtype].filter(Boolean).join(' - ');

    return {
      ...feature,
      kind,
      details: lineDetails ? [lineDetails] : [],
    };
  }

  // kind === 'point'
  const { feature } = params;
  const pointDetails = [feature.subtype, feature.action].filter(Boolean).join(' - ');

  return {
    ...feature,
    kind,
    details: pointDetails ? [pointDetails] : [],
  };
};

type FeatureSelectionContextType = {
  selectedFeature: SelectedFeature | null;
  setSelectedFeature: (feature: SelectedFeature | null) => void;
  enrichFeature: (params: EnrichFeatureParams) => SelectedFeature;
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
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);

  return (
    <FeatureSelectionContext.Provider value={{ selectedFeature, setSelectedFeature, enrichFeature }}>
      {children}
    </FeatureSelectionContext.Provider>
  );
};
