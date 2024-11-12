import Collection from '@arcgis/core/core/Collection.js';
import { Button, Tag, TagGroup } from '@ugrc/utah-design-system';
import { useEffect, useState } from 'react';
import { type Selection } from 'react-aria-components';
import { type FeatureType } from './data/filters';
import { areSetsEqual } from './utils';

const defaultState = new Set(['Proposed', 'Current', 'Pending Completed', 'Completed']);
const all = '';
const none = '1=0';

const setDefinitionExpression = (layers: Collection<__esri.FeatureLayer>, keys: Selection) =>
  layers
    .filter((x) => x.id.startsWith('feature'))
    .forEach((layer) => {
      if (keys === 'all') {
        layer.definitionExpression = all;

        return;
      }

      if (keys.size === 0) {
        layer.definitionExpression = none;

        return;
      }

      const statusField = layer.id === 'feature-centroids' ? 'status' : 'statusDescription';

      layer.definitionExpression = `${statusField} in (${Array.from(keys)
        .map((status) => `'${status}'`)
        .join(',')})`;
    });

export const FeatureData = ({
  layers,
  featureTypes,
}: {
  layers: __esri.Collection<__esri.FeatureLayer>;
  featureTypes: FeatureType[];
}) => {
  const [selected, setSelected] = useState<Selection>(defaultState);

  // synchronizes the definition expressions with the initial ui state
  useEffect(() => {
    setDefinitionExpression(layers, selected);
  }, [layers, selected]);

  return (
    <>
      <TagGroup selectionMode="multiple" selectedKeys={selected} onSelectionChange={setSelected}>
        {featureTypes.map(({ code, featureType }) => (
          <Tag id={featureType} key={code} textValue={featureType}>
            {featureType}
          </Tag>
        ))}
      </TagGroup>
      {!areSetsEqual(defaultState, selected === 'all' ? new Set([]) : selected) && (
        <span>
          <Button variant="destructive" size="extraSmall" onPress={() => setSelected(defaultState)}>
            Reset
          </Button>
        </span>
      )}
    </>
  );
};
