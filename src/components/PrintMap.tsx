import { execute } from '@arcgis/core/rest/print';
import PrintParameters from '@arcgis/core/rest/support/PrintParameters';
import PrintTemplate from '@arcgis/core/rest/support/PrintTemplate';
import type MapView from '@arcgis/core/views/MapView';
import type { ComponentOptions } from '@arcgis/core/views/ui/types';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@ugrc/utah-design-system/src/components/Button';
import { Spinner } from '@ugrc/utah-design-system/src/components/Spinner';
import { TextField } from '@ugrc/utah-design-system/src/components/TextField';
import { PrinterIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MapButton } from './MapButton';

type PrintMapProps = {
  view: MapView;
  position?: ComponentOptions['position'];
};

const URL = `https://print.ugrc.utah.gov/v2/${import.meta.env.VITE_PRINT_PROXY_ACCOUNT}/arcgis/rest/services/WRI/ExportWebMap/GPServer/Export%20Web%20Map`;
const DEFAULT_TITLE = 'Created by WRI Online Map';

type ArcGISServerError = {
  messages?: { description: string }[];
};

async function executePrint({ view, title }: { view: MapView; title: string }) {
  const template = new PrintTemplate({
    exportOptions: {
      dpi: 300,
    },
    layoutOptions: {
      titleText: title || DEFAULT_TITLE,
    },
    format: 'pdf',
    // @ts-expect-error - our custom layout id is missing from their type definitions
    layout: 'Layout',
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const slot = position ?? 'top-left';

  const { data, error, mutate, isPending } = useMutation({
    mutationFn: executePrint,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ view, title: title.trim() });
  };

  return (
    <div ref={containerRef} className="relative" slot={slot}>
      <MapButton IconComponent={PrinterIcon} label="Export Map to PDF" onPress={() => setIsOpen((open) => !open)} />
      {isOpen && (
        <div className="absolute right-full top-0 z-10 mr-2 w-72 rounded-xl border border-black/10 bg-white p-4 text-slate-700 shadow-2xl">
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
        </div>
      )}
    </div>
  );
}
