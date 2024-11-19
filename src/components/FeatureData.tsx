import { Button, Radio, RadioGroup, Tag, TagGroup } from '@ugrc/utah-design-system';
import { Dispatch, useContext } from 'react';
import { type Key } from 'react-stately';
import { FilterAction, FilterContext } from './contexts';
import { FeatureType } from './data/filters';
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
              features: {
                types: value as Set<Key>,
              },
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
                features: {
                  types: defaultFeatureState as Set<Key>,
                },
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
                features: {
                  types: emptySet,
                },
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
            features: {
              join: value as 'and' | 'or',
            },
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
