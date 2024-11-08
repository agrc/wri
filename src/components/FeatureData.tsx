import Collection from '@arcgis/core/core/Collection.js';
import { Button, Tag, TagGroup } from '@ugrc/utah-design-system';
import { useEffect, useState } from 'react';
import { type Selection } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import { ProjectStatus } from './data/filters';
import { areSetsEqual } from './utils';

const defaultState = new Set(['Proposed', 'Current', 'Pending Completed', 'Completed']);
const all = '';
const none = '1=0';

const tagStyles = tv({
  variants: {
    status: {
      draft: 'data-[selected]:bg-zinc-500 data-[selected]:hover:border-zinc-700 data-[selected]:border-gray-200',
      proposed: 'data-[selected]:bg-zinc-800 data-[selected]:hover:border-zinc-900 data-[selected]:border-gray-200',
      current: 'data-[selected]:bg-sky-600 data-[selected]:hover:border-sky-800 data-[selected]:border-gray-200',
      'pending completed':
        'data-[selected]:bg-yellow-500 data-[selected]:hover:border-yellow-600 data-[selected]:border-gray-200',
      completed: 'data-[selected]:bg-green-700 data-[selected]:hover:border-green-900 data-[selected]:border-gray-200',
      cancelled: 'data-[selected]:bg-red-700 data-[selected]:hover:border-red-900 data-[selected]:border-gray-200',
    },
  },
});

type Status = keyof typeof tagStyles.variants.status;

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
  status,
}: {
  layers: __esri.Collection<__esri.FeatureLayer>;
  status: ProjectStatus[];
}) => {
  const [selected, setSelected] = useState<Selection>(defaultState);

  // synchronizes the definition expressions with the initial ui state
  useEffect(() => {
    setDefinitionExpression(layers, selected);
  }, [layers, selected]);

  return (
    <>
      <TagGroup selectionMode="multiple" selectedKeys={selected} onSelectionChange={setSelected}>
        {status.map(({ code, value }) => (
          <Tag id={value} key={code} textValue={value} className={tagStyles({ status: value.toLowerCase() as Status })}>
            {value}
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
