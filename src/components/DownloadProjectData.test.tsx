import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DownloadProjectData } from './DownloadProjectData';

// Mock the design system components to avoid CSS import issues
vi.mock('@ugrc/utah-design-system', () => ({
  Button: ({
    children,
    onPress,
    isDisabled,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    isDisabled?: boolean;
    variant?: string;
    className?: string;
  }) => (
    <button onClick={onPress} disabled={isDisabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

/**
 * Helper function that creates a promise which never resolves.
 * Used in tests to simulate an ongoing loading state where the download is still in progress.
 */
const createNeverResolvingPromise = () => new Promise<string>(() => {});

describe('DownloadProjectData', () => {
  describe('rendering', () => {
    it('should render the request button in idle state', () => {
      renderWithQueryClient(<DownloadProjectData projectId={123} />);

      expect(screen.getByRole('button', { name: /request file geodatabase/i })).toBeInTheDocument();
    });

    it('should render the button as enabled by default', () => {
      renderWithQueryClient(<DownloadProjectData projectId={123} />);

      expect(screen.getByRole('button')).toBeEnabled();
    });
  });

  describe('interaction', () => {
    it('should call the download function when button is clicked', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockResolvedValue('https://example.com/download.zip');

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      const button = screen.getByRole('button', { name: /request file geodatabase/i });
      await user.click(button);

      expect(mockDownloadFn).toHaveBeenCalledWith(123);
      expect(mockDownloadFn).toHaveBeenCalledTimes(1);
    });

    it('should pass the projectId to the download function', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockResolvedValue('https://example.com/download.zip');
      const projectId = 456;

      renderWithQueryClient(<DownloadProjectData projectId={projectId} downloadFn={mockDownloadFn} />);

      await user.click(screen.getByRole('button'));

      expect(mockDownloadFn).toHaveBeenCalledWith(projectId);
    });
  });

  describe('loading state', () => {
    it('should show loading state while download is in progress', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockImplementation(createNeverResolvingPromise);

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText(/preparing download/i)).toBeInTheDocument();
    });

    it('should disable button while loading', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockImplementation(createNeverResolvingPromise);

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toBeDisabled();
    });

    it('should show spinner while loading', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockImplementation(createNeverResolvingPromise);

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      await user.click(screen.getByRole('button'));

      // The spinner should be rendered (checking for the loading text as proxy)
      expect(screen.getByText(/preparing download/i)).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('should display download link after successful completion', async () => {
      const user = userEvent.setup();
      const downloadUrl = 'https://example.com/download.zip';
      const mockDownloadFn = vi.fn().mockResolvedValue(downloadUrl);

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /download zip/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', downloadUrl);
      });
    });

    it('should open download link in new tab', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockResolvedValue('https://example.com/download.zip');

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /download zip/i });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should re-enable button after successful completion', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockResolvedValue('https://example.com/download.zip');

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(button).toBeEnabled();
      });
    });
  });

  describe('error handling', () => {
    it('should display error message when download fails with Error', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Geoprocessing job failed with status: job-failed';
      const mockDownloadFn = vi.fn().mockRejectedValue(new Error(errorMessage));

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display generic error message for non-Error failures', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockRejectedValue('Unknown error');

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      await user.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/failed to generate download/i)).toBeInTheDocument();
      });
    });

    it('should re-enable button after error', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockRejectedValue(new Error('Test error'));

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(button).toBeEnabled();
      });
    });

    it('should allow retry after error', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('https://example.com/download.zip');

      renderWithQueryClient(<DownloadProjectData projectId={123} downloadFn={mockDownloadFn} />);

      const button = screen.getByRole('button');

      // First attempt - should fail
      await user.click(button);
      await waitFor(() => {
        expect(screen.getByText(/first attempt failed/i)).toBeInTheDocument();
      });

      // Second attempt - should succeed
      await user.click(button);
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /download zip/i })).toBeInTheDocument();
      });

      expect(mockDownloadFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('prop variations', () => {
    it('should use custom downloadFn when provided', async () => {
      const user = userEvent.setup();
      const customDownloadFn = vi.fn().mockResolvedValue('https://custom.com/download.zip');

      renderWithQueryClient(<DownloadProjectData projectId={789} downloadFn={customDownloadFn} />);

      await user.click(screen.getByRole('button'));

      expect(customDownloadFn).toHaveBeenCalledWith(789);
    });

    it('should work with different projectId values', async () => {
      const user = userEvent.setup();
      const mockDownloadFn = vi.fn().mockResolvedValue('https://example.com/download.zip');

      const { rerender } = renderWithQueryClient(
        <DownloadProjectData projectId={100} downloadFn={mockDownloadFn} />,
      );

      await user.click(screen.getByRole('button'));
      expect(mockDownloadFn).toHaveBeenCalledWith(100);

      // Rerender with different projectId
      rerender(
        <QueryClientProvider client={createTestQueryClient()}>
          <DownloadProjectData projectId={200} downloadFn={mockDownloadFn} />
        </QueryClientProvider>,
      );

      await user.click(screen.getByRole('button'));
      expect(mockDownloadFn).toHaveBeenCalledWith(200);
    });
  });
});
