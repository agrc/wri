import React, { type JSX } from 'react';
import { GridList, GridListSection, Toolbar, type Key, type Selection } from 'react-aria-components';
import { FeatureCard } from './FeatureCard';
import type { Feature, PolygonFeatures } from './ProjectSpecific';

export type FeatureDetails = { layer: string; id: number };

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

const createFeatureDetails = (
  projectId: number,
  kind: FeatureKind,
  id?: number | nullish,
): FeatureDetails | undefined => {
  if (typeof id !== 'number') {
    return undefined;
  }

  return { layer: getLayerId(projectId, kind), id };
};

const serializeFeatureDetails = (details: FeatureDetails): string => {
  return `${details.layer}${FEATURE_KEY_SEPARATOR}${details.id}`;
};

const parseFeatureKey = (key?: Key): FeatureDetails | undefined => {
  if (key == null) {
    return undefined;
  }

  const raw = typeof key === 'string' ? key : String(key);
  const [layer, idPart] = raw.split(FEATURE_KEY_SEPARATOR);
  const id = Number(idPart);

  if (!layer || Number.isNaN(id)) {
    return undefined;
  }

  return { layer, id };
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

const extractDetailsFromSelection = (selection: Selection | Key | null | undefined): FeatureDetails | undefined => {
  return parseFeatureKey(getFirstKey(selection));
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
      if (!feature) {
        return null;
      }

      const details = createFeatureDetails(projectId, 'poly', feature.id);
      if (!details) {
        return null;
      }

      const polyDetails = featureGroup
        .map((pt) => [pt?.action, pt?.subtype, pt?.herbicide].filter(Boolean).join(' - '))
        .filter((line) => line.length > 0);
      const isRetreatment = feature.retreatment?.toUpperCase() === 'Y';

      return (
        <FeatureCard
          key={`poly-${feature.id}`}
          itemId={serializeFeatureDetails(details)}
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
      if (!feature) {
        return null;
      }

      const details = createFeatureDetails(projectId, 'line', feature.id);
      if (!details) {
        return null;
      }

      const featureDetails = [feature.action, feature.subtype].filter(Boolean).join(' - ');

      return (
        <FeatureCard
          key={`line-${feature.id ?? index}`}
          itemId={serializeFeatureDetails(details)}
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
      if (!feature) {
        return null;
      }

      const details = createFeatureDetails(projectId, 'point', feature.id);
      if (!details) {
        return null;
      }

      const featureDetails = [feature.subtype, feature.action].filter(Boolean).join(' - ');

      return (
        <FeatureCard
          key={`point-${feature.id ?? index}`}
          itemId={serializeFeatureDetails(details)}
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
        const details = extractDetailsFromSelection(selection);
        if (!details) {
          onClear?.();

          return;
        }

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
