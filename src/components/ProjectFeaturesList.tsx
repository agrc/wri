import { AlertDialog, Button, Modal, Tooltip } from '@ugrc/utah-design-system';
import type { Feature, FeatureKind, PolygonFeatures } from '@ugrc/wri-shared/types';
import { BookOpenText, Pencil, Trash2 } from 'lucide-react';
import React, { type JSX } from 'react';
import {
  DialogTrigger,
  GridList,
  GridListSection,
  Toolbar,
  TooltipTrigger,
  type Key,
  type Selection,
} from 'react-aria-components';
import { useFeatureSelection } from './contexts';
import { ErrorBanner } from './ErrorBanner';
import { FeatureCard } from './FeatureCard';
import {
  formatPolygonFeatureDetail,
  getProjectFeatureLayerId,
  parseFeatureKey,
  serializeFeatureKey,
} from './featureSelection';
const sectionHeadingByKind: Record<FeatureKind, string> = {
  poly: 'Polygon features',
  line: 'Line features',
  point: 'Point features',
} as const;

const notNull = <T,>(value: T | null | undefined): value is T => value != null;

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
  allowEdits: boolean;
  polygons: PolygonFeatures;
  lines: Feature[];
  points: Feature[];
  isVisible?: boolean;
  onEdit?: (featureId: number, featureType: string, featureKind: FeatureKind) => void | Promise<void>;
  onDelete?: (featureId: number, featureType: string, featureKind: FeatureKind) => void | Promise<void>;
  onViewDetails?: () => void;
  renderOpacity?: (layerId: string, oid?: number) => JSX.Element | null;
  featureError?: string | null;
  onDismissFeatureError?: () => void;
};

export const ProjectFeaturesList: React.FC<Props> = ({
  projectId,
  allowEdits,
  polygons,
  lines,
  points,
  isVisible = true,
  onEdit,
  onDelete,
  onViewDetails,
  renderOpacity,
  featureError,
  onDismissFeatureError,
}) => {
  const { clearSelection, selectedFeatureKey, selectFeature } = useFeatureSelection();
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!selectedFeatureKey || !isVisible) {
      return;
    }

    const selectedItem = listRef.current?.querySelector<HTMLElement>(`[data-feature-key="${selectedFeatureKey}"]`);

    // give the tab time to render the content
    setTimeout(() => {
      selectedItem?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }, 0);
  }, [isVisible, selectedFeatureKey]);

  const renderControls = (kind: FeatureKind, featureId?: number | nullish, featureType?: string) => {
    if (typeof featureId !== 'number') {
      return null;
    }

    const featureKey = serializeFeatureKey(kind, featureId);
    const isSelected = selectedFeatureKey === featureKey;
    const opacityControl = renderOpacity?.(getProjectFeatureLayerId(projectId, kind), featureId);

    return (
      <Toolbar aria-label="Feature options" className="flex gap-x-1">
        {opacityControl}
        {allowEdits && isSelected && (
          <>
            <TooltipTrigger>
              <div>
                <Button
                  variant="icon"
                  className="h-8 min-w-8 rounded border border-zinc-400"
                  onPress={() => onEdit?.(featureId, featureType ?? '', kind)}
                  aria-label="Edit feature"
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
              <Tooltip>Edit Feature</Tooltip>
            </TooltipTrigger>
            <TooltipTrigger>
              <div>
                <DialogTrigger>
                  <Button
                    variant="icon"
                    className="h-8 min-w-8 rounded border border-zinc-400"
                    aria-label="Delete feature"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <Modal>
                    <AlertDialog
                      title="Delete Feature"
                      variant="destructive"
                      actionLabel="Delete"
                      onAction={() => onDelete?.(featureId, featureType ?? '', kind)}
                    >
                      Are you sure you want to delete this feature? This action cannot be undone.
                    </AlertDialog>
                  </Modal>
                </DialogTrigger>
              </div>
              <Tooltip>Delete Feature</Tooltip>
            </TooltipTrigger>
          </>
        )}
        {onViewDetails && isSelected && (
          <TooltipTrigger>
            <div>
              <Button
                variant="icon"
                className="h-8 min-w-8 rounded border border-zinc-400"
                onPress={() => {
                  onViewDetails();
                }}
                aria-label="View details"
              >
                <BookOpenText className="size-4" />
              </Button>
            </div>
            <Tooltip>View Feature Details</Tooltip>
          </TooltipTrigger>
        )}
      </Toolbar>
    );
  };

  const polygonItems = Object.values(polygons ?? {})
    .map((featureGroup) => {
      const feature = featureGroup?.[0];
      if (!feature || typeof feature.id !== 'number') {
        return null;
      }

      const polyDetails = featureGroup.map((pt) => formatPolygonFeatureDetail(pt)).filter((line) => line.length > 0);
      const isRetreatment = feature.retreatment === true;

      return (
        <FeatureCard
          key={`poly-${feature.id}`}
          itemId={serializeFeatureKey('poly', feature.id)}
          title={feature.type}
          size={feature.size}
          controls={renderControls('poly', feature.id, feature.type)}
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
          controls={renderControls('line', feature.id, feature.type)}
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
          controls={renderControls('point', feature.id, feature.type)}
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
    <>
      <ErrorBanner message={featureError} onDismiss={onDismissFeatureError} />
      <GridList
        ref={listRef}
        selectionMode="single"
        selectedKeys={selectedFeatureKey ? new Set([selectedFeatureKey]) : new Set()}
        className="flex flex-col gap-y-2 dark:text-zinc-100"
        renderEmptyState={() => <p>This project has no features</p>}
        onSelectionChange={(selection: Selection) => {
          const key = getFirstKey(selection);
          const parsed = parseFeatureKey(key == null ? undefined : String(key));
          if (!parsed) {
            clearSelection();

            return;
          }

          selectFeature({ projectId, kind: parsed.kind, id: parsed.id }, 'list');
        }}
        aria-label="Project features list"
      >
        {sections.map(({ kind, items }) => (
          <GridListSection key={kind} aria-label={sectionHeadingByKind[kind]} className="flex flex-col gap-y-2">
            {items}
          </GridListSection>
        ))}
      </GridList>
    </>
  );
};

export default ProjectFeaturesList;
