import { Button, Radio, RadioGroup, Tag, TagGroup } from '@ugrc/utah-design-system';
import { type Dispatch, useContext } from 'react';
import { type Key } from 'react-stately';
import { type FilterAction, FilterContext } from './contexts';
import type { FeatureType } from './data/filters';
import { areSetsEqual } from './utils';
const emptySet = new Set<Key>();

export const FeatureData = ({ featureTypes }: { featureTypes: FeatureType[] }) => {
  const { dispatch, defaultFeatureState, selectedFeatures } = useContext(FilterContext);

  return (
    <>
      <TagGroup
        selectionMode="multiple"
        defaultSelectedKeys={defaultFeatureState}
        selectedKeys={selectedFeatures}
        onSelectionChange={(value) =>
          dispatch({
            type: 'set',
            payload: {
              features: value as Set<Key>,
            },
            metadata: 'feature',
          })
        }
      >
        {featureTypes.map(({ code, featureType }) => (
          <Tag id={featureType} key={code} textValue={featureType}>
            {featureType}
          </Tag>
        ))}
      </TagGroup>
      <span className="flex gap-2">
        <Button
          variant="destructive"
          size="extraSmall"
          isDisabled={areSetsEqual(
            defaultFeatureState as Set<Key>,
            selectedFeatures === 'all' ? emptySet : selectedFeatures,
          )}
          onPress={() =>
            dispatch({
              type: 'set',
              payload: {
                features: defaultFeatureState as Set<Key>,
              },
              metadata: 'feature',
            })
          }
        >
          Reset
        </Button>
        <Button
          variant="destructive"
          size="extraSmall"
          isDisabled={selectedFeatures === 'all' || selectedFeatures.size === 0}
          onPress={() =>
            dispatch({
              type: 'set',
              payload: {
                features: emptySet,
              },
              metadata: 'feature',
            })
          }
        >
          Clear
        </Button>
      </span>
      <JoinWith defaultValue={'or'} dispatch={dispatch} />
    </>
  );
};

export const JoinWith = ({ defaultValue, dispatch }: { defaultValue: string; dispatch: Dispatch<FilterAction> }) => {
  return (
    <RadioGroup
      defaultValue={defaultValue}
      label="Feature match style"
      onChange={(value) => {
        dispatch({
          type: 'set',
          payload: {
            join: value as 'and' | 'or',
          },
          metadata: 'feature-join',
        });
      }}
    >
      <Radio value="or">any</Radio>
      <Radio value="and">all</Radio>
    </RadioGroup>
  );
};
