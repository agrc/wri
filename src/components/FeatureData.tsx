import Collection from '@arcgis/core/core/Collection.js';
import { Tag, TagGroup } from '@ugrc/utah-design-system';
import { useEffect } from 'react';
import { type Selection } from 'react-aria-components';
import { ProjectStatus } from './data/filters';

const initialState = ['Proposed', 'Current', 'Pending Completed', 'Completed'];
const all = '';
const none = '1=0';

const setDefinitionExpression = (layers: Collection<__esri.FeatureLayer>, keys: Selection) => {
  layers
    .filter((x) => x.id.startsWith('feature'))
    .forEach((layer) => {
      console.log('layer', layer);
      if (keys === 'all') {
        layer.definitionExpression = all;

        return;
      }

      if (keys.size === 0) {
        layer.definitionExpression = none;

        return;
      }

      layer.definitionExpression = `status in (${Array.from(keys)
        .map((status) => `'${status}'`)
        .join(',')})`;
    });
};

export const FeatureData = ({
  layers,
  status,
}: {
  layers: __esri.Collection<__esri.FeatureLayer>;
  status: ProjectStatus[];
}) => {
  // synchronizes the definition expressions with the initial ui state
  useEffect(() => {
    setDefinitionExpression(layers, new Set(initialState));
  }, [layers]);

  return (
    <TagGroup
      defaultSelectedKeys={initialState}
      selectionMode="multiple"
      onSelectionChange={(selection) => setDefinitionExpression(layers, selection)}
    >
      {status.map(({ code, value }) => (
        <Tag id={value} key={code} textValue={value}>
          {value}
        </Tag>
      ))}
    </TagGroup>
  );
};
