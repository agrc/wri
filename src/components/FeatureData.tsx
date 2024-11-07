import { Tag, TagGroup } from '@ugrc/utah-design-system';
import { useCallback, useEffect } from 'react';
import { type Selection } from 'react-aria-components';
import { ProjectStatus } from './data/filters';

export type ReferenceLayer = __esri.Layer & __esri.ScaleRangeLayer;
export type ReferenceLayerWithMetadata = ReferenceLayer & { legendDescription?: string };

const initialState = ['Proposed', 'Current', 'Pending Completed', 'Completed'];
const all = '';
const none = '1=0';
export const FeatureData = ({
  layers,
  status,
}: {
  layers: __esri.Collection<__esri.FeatureLayer>;
  status: ProjectStatus[];
}) => {
  const setDefinitionExpression = useCallback(
    (keys: Selection) => {
      console.log('setDefinitionExpression', keys);

      layers
        .filter((x) => x.id.startsWith('feature'))
        .forEach((layer) => {
          console.log('layer', layer);
          if (keys === 'all') {
            layer.definitionExpression = all;

            console.log('setDefinitionExpression', layer.definitionExpression);

            return;
          }

          if (keys.size === 0) {
            layer.definitionExpression = none;

            console.log('setDefinitionExpression', layer.definitionExpression);

            return;
          }

          layer.definitionExpression = `status in (${Array.from(keys)
            .map((status) => `'${status}'`)
            .join(',')})`;

          console.log('setDefinitionExpression', layer.definitionExpression);
        });
    },
    [layers],
  );

  useEffect(() => {
    console.log('useEffect');
    setDefinitionExpression(new Set(initialState));
  }, [setDefinitionExpression]);

  return (
    <TagGroup defaultSelectedKeys={initialState} selectionMode="multiple" onSelectionChange={setDefinitionExpression}>
      {status.map(({ code, value }) => (
        <Tag id={value} key={code} textValue={value}>
          {value}
        </Tag>
      ))}
    </TagGroup>
  );
};
