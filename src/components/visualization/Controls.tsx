'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface ControlsProps {
  // Preset selection
  selectedPreset: string;
  onPresetChange: (presetId: string) => void;
  presets: { id: string; name: string }[];
  
  // Resolution selection
  selectedResolution: string;
  onResolutionChange: (resolutionId: string) => void;
  resolutions: { id: string; label: string }[];
  
  // Volume fraction
  volumeFraction: number;
  onVolumeFractionChange: (value: number) => void;
  
  // Playback controls
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  
  // State
  disabled?: boolean;
}

/**
 * Control panel for the topology optimization demo
 */
export function Controls({
  selectedPreset,
  onPresetChange,
  presets,
  selectedResolution,
  onResolutionChange,
  resolutions,
  volumeFraction,
  onVolumeFractionChange,
  isRunning,
  onStart,
  onPause,
  onReset,
  disabled = false,
}: ControlsProps) {
  return (
    <div className="space-y-4">
      {/* Problem and Resolution Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Preset Tabs */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Problem
          </label>
          <Tabs value={selectedPreset} onValueChange={onPresetChange}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${presets.length}, 1fr)` }}>
              {presets.map((preset) => (
                <TabsTrigger 
                  key={preset.id} 
                  value={preset.id}
                  disabled={disabled && isRunning}
                  className="text-xs sm:text-sm"
                >
                  {preset.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        
        {/* Resolution Toggle */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Resolution
          </label>
          <Tabs value={selectedResolution} onValueChange={onResolutionChange}>
            <TabsList>
              {resolutions.map((res) => (
                <TabsTrigger 
                  key={res.id} 
                  value={res.id}
                  disabled={disabled && isRunning}
                  className="text-xs sm:text-sm px-2 sm:px-3"
                >
                  {res.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      {/* Volume and Controls Row */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Volume Slider */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-foreground">
              Material to keep
            </label>
            <span className="text-sm font-mono text-muted-foreground">
              {Math.round(volumeFraction * 100)}%
            </span>
          </div>
          <Slider
            value={[volumeFraction * 100]}
            onValueChange={([value]) => onVolumeFractionChange(value / 100)}
            min={10}
            max={80}
            step={5}
            disabled={disabled && isRunning}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Less material</span>
            <span>More material</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          {isRunning ? (
            <Button onClick={onPause} variant="outline" className="gap-2">
              <Pause className="w-4 h-4" />
              Pause
            </Button>
          ) : (
            <Button onClick={onStart} className="gap-2">
              <Play className="w-4 h-4" />
              {disabled ? 'Continue' : 'Start'}
            </Button>
          )}
          <Button onClick={onReset} variant="outline" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Controls;
