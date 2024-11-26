import { Button, Tag, TagGroup } from '@ugrc/utah-design-system';
import { useContext } from 'react';
import { Key } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import { FilterContext } from './contexts';
import { ProjectStatuses } from './data/filters';
import { areSetsEqual } from './utils';

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

export type Status = keyof typeof tagStyles.variants.status;
const emptySet = new Set<Key>();

export const ProjectStatus = ({ status }: { status: ProjectStatuses[] }) => {
  const { dispatch, defaultProjectState, selectedProjects } = useContext(FilterContext);

  return (
    <>
      <TagGroup
        selectionMode="multiple"
        defaultSelectedKeys={defaultProjectState}
        selectedKeys={selectedProjects}
        onSelectionChange={(value) =>
          dispatch({
            type: 'set',
            payload: {
              projects: value as Set<Key>,
            },
            metadata: 'projects',
          })
        }
      >
        {status.map(({ code, value }) => (
          <Tag id={value} key={code} textValue={value} className={tagStyles({ status: value.toLowerCase() as Status })}>
            {value}
          </Tag>
        ))}
      </TagGroup>
      {!areSetsEqual(defaultProjectState as Set<Key>, selectedProjects === 'all' ? emptySet : selectedProjects) && (
        <span>
          <Button
            variant="destructive"
            size="extraSmall"
            onPress={() =>
              dispatch({
                type: 'set',
                payload: {
                  projects: defaultProjectState as Set<Key>,
                },
                metadata: 'projects',
              })
            }
          >
            Reset
          </Button>
        </span>
      )}
    </>
  );
};
