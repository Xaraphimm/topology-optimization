'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Image, FileCode, ChevronDown, Loader2 } from 'lucide-react';
import {
  exportAndDownloadImage,
  exportAndDownloadSVG,
  type ImageExportOptions,
  type SVGExportOptions,
} from '@/lib/export';

/**
 * Export format type
 */
type ExportFormatType = 'png-4x' | 'png-8x' | 'png-16x' | 'svg';

interface ExportOption {
  id: ExportFormatType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'png-4x',
    label: 'PNG (4x)',
    description: 'High resolution image',
    icon: <Image className="w-4 h-4" />,
  },
  {
    id: 'png-8x',
    label: 'PNG (8x)',
    description: 'Very high resolution',
    icon: <Image className="w-4 h-4" />,
  },
  {
    id: 'png-16x',
    label: 'PNG (16x)',
    description: 'Ultra high resolution',
    icon: <Image className="w-4 h-4" />,
  },
  {
    id: 'svg',
    label: 'SVG Vector',
    description: 'Scalable vector graphics',
    icon: <FileCode className="w-4 h-4" />,
  },
];

interface ExportButtonProps {
  /** Density data to export */
  densities: Float64Array | null;
  /** Number of elements in x direction */
  nelx: number;
  /** Number of elements in y direction */
  nely: number;
  /** Base filename for export */
  filename?: string;
  /** Whether export is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Export button component with dropdown for format selection
 * 
 * Provides options to export the topology optimization result as:
 * - High-resolution PNG (4x, 8x, 16x upsampling)
 * - SVG vector graphics (infinitely scalable)
 */
export function ExportButton({
  densities,
  nelx,
  nely,
  filename = 'topology-optimization',
  disabled = false,
  className = '',
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormatType | null>(null);

  const handleExport = useCallback(async (format: ExportFormatType) => {
    if (!densities || densities.length === 0) {
      console.warn('No density data to export');
      return;
    }

    setIsExporting(true);
    setExportingFormat(format);
    setIsOpen(false);

    try {
      if (format.startsWith('png-')) {
        // PNG export
        const scaleStr = format.replace('png-', '').replace('x', '');
        const scale = parseInt(scaleStr, 10);
        
        const options: Partial<ImageExportOptions> = {
          scale,
          interpolation: 'bicubic',
          format: 'png',
          gammaCorrection: true,
          contrastEnhancement: true,
        };

        await exportAndDownloadImage(
          densities,
          nelx,
          nely,
          `${filename}_${scale}x.png`,
          options
        );
      } else if (format === 'svg') {
        // SVG export
        const options: Partial<SVGExportOptions> = {
          smoothing: true,
          smoothingResolution: 6,
          scale: 10,
          fillColor: '#000000',
          backgroundColor: '#ffffff',
        };

        exportAndDownloadSVG(
          densities,
          nelx,
          nely,
          `${filename}.svg`,
          options
        );
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  }, [densities, nelx, nely, filename]);

  const isDisabled = disabled || !densities || densities.length === 0;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Main button */}
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled || isExporting}
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </Button>

      {/* Dropdown menu */}
      {isOpen && !isExporting && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown content */}
          <div className="absolute right-0 mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="p-1">
              {EXPORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleExport(option.id)}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left rounded-md hover:bg-accent transition-colors"
                >
                  <span className="mt-0.5 text-muted-foreground">
                    {option.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Help text */}
            <div className="px-3 py-2 bg-muted/50 border-t border-border">
              <p className="text-xs text-muted-foreground">
                PNG exports use bicubic upsampling for smooth edges. 
                SVG exports are infinitely scalable.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ExportButton;
