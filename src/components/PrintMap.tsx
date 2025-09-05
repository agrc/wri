import { execute } from '@arcgis/core/rest/print';
import PrintParameters from '@arcgis/core/rest/support/PrintParameters';
import PrintTemplate from '@arcgis/core/rest/support/PrintTemplate';
import { useMutation } from '@tanstack/react-query';
import { Button, Dialog, Popover, Spinner, TextField } from '@ugrc/utah-design-system';
import { useViewUiPosition } from '@ugrc/utilities/hooks';
import { PrinterIcon } from 'lucide-react';
import { useState } from 'react';
import { DialogTrigger } from 'react-aria-components';
import { MapButton } from './MapButton';

type PrintMapProps = {
  view: __esri.MapView;
  position?: __esri.UIAddComponent['position'];
};

// TODO: switch out the base of this URL to point to env var once it is published to that server
// const URL = `${import.meta.env.VITE_GIS_BASE_URL}/arcgis/rest/services/WRI/ExportWebMap/GPServer/Export%20Web%20Map`
const URL = 'https://mapserv.utah.gov/arcgis/rest/services/WRI/ExportWebMap/GPServer/Export%20Web%20Map';
const DEFAULT_TITLE = 'Created by WRI Online Map';

type ArcGISServerError = {
  messages?: { description: string }[];
};

async function executePrint({ view, title }: { view: __esri.MapView; title: string }) {
  const template = new PrintTemplate({
    exportOptions: {
      dpi: 300,
    },
    layoutOptions: {
      titleText: title || DEFAULT_TITLE,
    },
    format: 'pdf',
    // @ts-expect-error - our custom layout id is missing from their type definitions
    layout: 'layout',
  });

  const params = new PrintParameters({
    view,
    template,
  });

  let result;
  try {
    result = await execute(URL, params);
  } catch (error: ArcGISServerError | unknown) {
    if ((error as ArcGISServerError).messages) {
      console.error(
        `Print service error messages: ${(error as ArcGISServerError).messages?.map((m) => m.description).join(', ')}`,
      );
    }
    throw new Error(`Failed to generate PDF. Please try again later.`);
  }

  return result.url;
}

export function PrintMap({ view, position }: PrintMapProps) {
  const uiPosition = useViewUiPosition(view, position ?? 'top-left');
  const [title, setTitle] = useState<string>('');

  const { data, error, mutate, isPending } = useMutation({
    mutationFn: executePrint,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ view, title: title.trim() });
  };

  return (
    <DialogTrigger>
      <MapButton ref={uiPosition} IconComponent={PrinterIcon} label="Export Map to PDF" />
      <Popover showArrow>
        <Dialog>
          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <TextField inputProps={{ placeholder: 'optional' }} label="Map title" value={title} onChange={setTitle} />
            <Button type="submit" className="w-full" variant="primary" isDisabled={isPending}>
              {isPending ? (
                <div className="size-5">
                  <Spinner />
                </div>
              ) : (
                'Export to PDF'
              )}
            </Button>
            {data && (
              <a className="text-center" href={data} target="_blank" rel="noopener noreferrer">
                Download PDF
              </a>
            )}
            {error && <div className="text-red-500">{error.message}</div>}
          </form>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
