import React, { type JSX } from 'react';
import { GridList, GridListSection, Toolbar, type Key, type Selection } from 'react-aria-components';
import { enrichFeature, useFeatureSelection } from './contexts';
import { FeatureCard } from './FeatureCard';
import type { Feature, PolygonFeature, PolygonFeatures } from './ProjectSpecific';

export type FeatureDetails = { layer: string; id: number; type: FeatureType };

type FeatureType =
  | 'terrestrial treatment area'
  | 'aquatic/riparian treatment area'
  | 'affected area'
  | 'easement/acquisition'
  | 'guzzler'
  | 'water development point feature'
  | 'other point feature'
  | 'fish passage structure'
  | 'fence'
  | 'pipeline'
  | 'dam';

type FeatureKind = 'poly' | 'line' | 'point';

const FEATURE_KEY_SEPARATOR = '|';
const baseLayerIdByKind: Record<FeatureKind, string> = {
  poly: 'feature-poly',
  line: 'feature-line',
  point: 'feature-point',
} as const;
const sectionHeadingByKind: Record<FeatureKind, string> = {
  poly: 'Polygon features',
  line: 'Line features',
  point: 'Point features',
} as const;

const notNull = <T,>(value: T | null | undefined): value is T => value != null;

const getLayerId = (projectId: number, kind: FeatureKind) => `project-${projectId}-${baseLayerIdByKind[kind]}`;

const serializeFeatureKey = (kind: FeatureKind, id: number): string => {
  return `${kind}${FEATURE_KEY_SEPARATOR}${id}`;
};

const parseFeatureKey = (key?: Key): { kind: FeatureKind; id: number } | undefined => {
  if (key == null) {
    return undefined;
  }

  const raw = typeof key === 'string' ? key : String(key);
  const [kind, idPart] = raw.split(FEATURE_KEY_SEPARATOR);
  const id = Number(idPart);

  if (!kind || Number.isNaN(id) || !(kind === 'poly' || kind === 'line' || kind === 'point')) {
    return undefined;
  }

  return { kind: kind as FeatureKind, id };
};

const getFirstKey = (selection: Selection | Key | null | undefined): Key | undefined => {
  if (!selection || selection === 'all') {
    return undefined;
  }

  if (selection instanceof Set) {
    const iterator = selection.values();
    const { value } = iterator.next();

    return value as Key | undefined;
  }

  return selection as Key;
};

type Props = {
  projectId: number;
  polygons: PolygonFeatures;
  lines: Feature[];
  points: Feature[];
  onSelect: (details: FeatureDetails) => boolean;
  onClear?: () => void;
  renderOpacity?: (layerId: string, oid?: number) => JSX.Element | null;
};

export const ProjectFeaturesList: React.FC<Props> = ({
  projectId,
  polygons,
  lines,
  points,
  onSelect,
  onClear,
  renderOpacity,
}) => {
  const { setSelectedFeature } = useFeatureSelection();
  const renderControls = (kind: FeatureKind, featureId?: number | nullish) => {
    if (!renderOpacity || typeof featureId !== 'number') {
      return null;
    }

    const control = renderOpacity(getLayerId(projectId, kind), featureId);
    if (!control) {
      return null;
    }

    return (
      <Toolbar aria-label="Feature options" className="flex gap-x-1">
        {control}
      </Toolbar>
    );
  };

  const polygonItems = Object.values(polygons ?? {})
    .map((featureGroup) => {
      const feature = featureGroup?.[0];
      if (!feature || typeof feature.id !== 'number') {
        return null;
      }

      const polyDetails = featureGroup
        .map((pt) => [pt?.action, pt?.subtype, pt?.herbicide].filter(Boolean).join(' - '))
        .filter((line) => line.length > 0);
      const isRetreatment = feature.retreatment?.toUpperCase() === 'Y';

      return (
        <FeatureCard
          key={`poly-${feature.id}`}
          itemId={serializeFeatureKey('poly', feature.id)}
          title={feature.type}
          size={feature.size}
          controls={renderControls('poly', feature.id)}
        >
          {isRetreatment && <p className="pl-2">Retreatment</p>}
          {polyDetails.length > 0 && (
            <ol className="list-inside list-decimal pl-2">
              {polyDetails.map((line, idx) => (
                <li key={`${feature.id}-action-${idx}`}>{line}</li>
              ))}
            </ol>
          )}
          {feature.description && <p className="pl-2">{feature.description}</p>}
        </FeatureCard>
      );
    })
    .filter(notNull);

  const lineItems = lines
    .map((feature, index) => {
      if (!feature || typeof feature.id !== 'number') {
        return null;
      }

      const featureDetails = [feature.action, feature.subtype].filter(Boolean).join(' - ');

      return (
        <FeatureCard
          key={`line-${feature.id ?? index}`}
          itemId={serializeFeatureKey('line', feature.id)}
          title={feature.type}
          size={feature.size}
          controls={renderControls('line', feature.id)}
        >
          {featureDetails && <p className="pl-2">{featureDetails}</p>}
          {feature.description && <p className="pl-2">{feature.description}</p>}
        </FeatureCard>
      );
    })
    .filter(notNull);

  const pointItems = points
    .map((feature, index) => {
      if (!feature || typeof feature.id !== 'number') {
        return null;
      }

      const featureDetails = [feature.subtype, feature.action].filter(Boolean).join(' - ');

      return (
        <FeatureCard
          key={`point-${feature.id ?? index}`}
          itemId={serializeFeatureKey('point', feature.id)}
          title={feature.type}
          size={feature.size}
          controls={renderControls('point', feature.id)}
        >
          <div className="pl-2">
            {featureDetails && <p>{featureDetails}</p>}
            {feature.description && <p className="pl-2">{feature.description}</p>}
          </div>
        </FeatureCard>
      );
    })
    .filter(notNull);

  const sections = (
    [
      { kind: 'poly', items: polygonItems },
      { kind: 'line', items: lineItems },
      { kind: 'point', items: pointItems },
    ] satisfies Array<{ kind: FeatureKind; items: JSX.Element[] }>
  ).filter((section) => section.items.length > 0);

  return (
    <GridList
      selectionMode="single"
      className="flex flex-col gap-y-2 dark:text-zinc-100"
      renderEmptyState={() => <p>This project has no features</p>}
      onSelectionChange={(selection: Selection) => {
        const parsed = parseFeatureKey(getFirstKey(selection));
        if (!parsed) {
          setSelectedFeature(null);
          onClear?.();

          return;
        }

        // Look up the full feature data based on the kind and id
        let foundFeature: Feature | PolygonFeature | undefined;
        let polyGroup: PolygonFeature[] | undefined;

        if (parsed.kind === 'poly') {
          polyGroup = Object.values(polygons).find((group) => group[0]?.id === parsed.id);
          foundFeature = polyGroup?.[0];
        } else if (parsed.kind === 'line') {
          foundFeature = lines.find((f) => f.id === parsed.id);
        } else if (parsed.kind === 'point') {
          foundFeature = points.find((f) => f.id === parsed.id);
        }

        if (!foundFeature) {
          setSelectedFeature(null);
          onClear?.();

          return;
        }

        // Enrich feature using context helper
        const enrichedFeature =
          parsed.kind === 'poly'
            ? enrichFeature({ kind: 'poly', feature: foundFeature as PolygonFeature, polyGroup: polyGroup! })
            : parsed.kind === 'line'
              ? enrichFeature({ kind: 'line', feature: foundFeature })
              : enrichFeature({ kind: 'point', feature: foundFeature });

        // Store enriched feature in context
        setSelectedFeature(enrichedFeature);

        const details: FeatureDetails = {
          layer: getLayerId(projectId, parsed.kind),
          id: parsed.id,
          type: foundFeature.type.toLowerCase() as FeatureType,
        };

        const isActive = onSelect(details);
        if (isActive === false) {
          onClear?.();
        }
      }}
    >
      {sections.map(({ kind, items }) => (
        <GridListSection key={kind} aria-label={sectionHeadingByKind[kind]} className="flex flex-col gap-y-2">
          {items}
        </GridListSection>
      ))}
    </GridList>
  );
};

export default ProjectFeaturesList;
