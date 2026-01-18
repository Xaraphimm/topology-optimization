'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, ViewMode } from './Canvas';
import { ProgressInfo } from './ProgressInfo';
import { ConvergenceGraphs } from './ConvergenceGraphs';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  useSoftMaterialOptimizer,
  type UseSoftMaterialOptimizerConfig,
} from '@/lib/optimizer/useSoftMaterialOptimizer';
import {
  SOFT_MATERIALS,
  getSoftMaterial,
  type SoftMaterial,
  formatStress,
} from '@/lib/soft-materials';
import {
  getRuptureRiskColor,
  getRuptureRiskLabel,
  getSafetyMarginLabel,
  getRuptureRiskClass,
} from '@/lib/rupture-colormap';
import { PRESETS, RESOLUTIONS, getMeshDimensions, getPreset } from '@/lib/presets';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Ruler,
  Beaker,
  Info,
} from 'lucide-react';

interface SoftMaterialsTabProps {
  className?: string;
}

/**
 * Soft Materials Optimization Tab
 *
 * Provides topology optimization for soft/hyperelastic materials
 * with stress constraints to prevent rupture.
 */
export function SoftMaterialsTab({ className = '' }: SoftMaterialsTabProps) {
  // Material and constraint state
  const [selectedMaterialId, setSelectedMaterialId] = useState('ecoflex-0030');
  const [safetyFactor, setSafetyFactor] = useState(2.0);
  const [minWallThickness, setMinWallThickness] = useState(1.0);
  const [elementSize, setElementSize] = useState(1.0);

  // Optimization parameters
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].id);
  const [selectedResolution, setSelectedResolution] = useState(RESOLUTIONS[0].id);
  const [volumeFraction, setVolumeFraction] = useState(0.5);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode | 'rupture'>('material');
  const [hasStarted, setHasStarted] = useState(false);

  // Get current material
  const material = useMemo(() => {
    return getSoftMaterial(selectedMaterialId) || SOFT_MATERIALS[0];
  }, [selectedMaterialId]);

  // Get mesh dimensions
  const preset = getPreset(selectedPreset) || PRESETS[0];
  const resolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
  const { nelx, nely } = getMeshDimensions(preset, resolution);

  // Boundary condition data for canvas
  const [bcData, setBcData] = useState<{
    supports: { x: number; y: number; type: 'pin' | 'roller-x' | 'roller-y' }[];
    loads: { x: number; y: number; dx: number; dy: number }[];
  }>({ supports: [], loads: [] });

  // Create optimizer config
  const optimizerConfig = useMemo<UseSoftMaterialOptimizerConfig | null>(() => {
    const currentPreset = getPreset(selectedPreset) || PRESETS[0];
    const currentResolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
    const dims = getMeshDimensions(currentPreset, currentResolution);

    const { forces, fixedDofs } = currentPreset.setup(dims.nelx, dims.nely);

    return {
      config: {
        nelx: dims.nelx,
        nely: dims.nely,
        volfrac: volumeFraction,
        penal: 3.0,
        rmin: Math.max(1.5, dims.nelx / 40),
        maxIter: 200,
        tolx: 0.01,
        nu: 0.45, // Higher for elastomers
        material,
        safetyFactor,
        minWallThickness,
        elementSize,
        enableStressConstraint: true,
        useFatigueLimit: false,
      },
      forces,
      fixedDofs,
    };
  }, [selectedPreset, selectedResolution, volumeFraction, material, safetyFactor, minWallThickness, elementSize]);

  // Update BC data
  const computedBcData = useMemo(() => {
    if (!optimizerConfig) return null;
    const currentPreset = getPreset(selectedPreset) || PRESETS[0];
    const currentResolution = RESOLUTIONS.find(r => r.id === selectedResolution) || RESOLUTIONS[0];
    const dims = getMeshDimensions(currentPreset, currentResolution);
    const { supports, loads } = currentPreset.setup(dims.nelx, dims.nely);
    return { supports, loads };
  }, [optimizerConfig, selectedPreset, selectedResolution]);

  useEffect(() => {
    if (computedBcData) {
      setBcData(computedBcData);
    }
  }, [computedBcData]);

  // Use soft material optimizer
  const {
    state,
    history,
    stressSummary,
    isRunning,
    isReady,
    error,
    start,
    pause,
    reset,
  } = useSoftMaterialOptimizer(optimizerConfig);

  // Reset key for detecting config changes
  const resetKey = useMemo(() => {
    return `${selectedPreset}-${selectedResolution}-${volumeFraction}-${selectedMaterialId}`;
  }, [selectedPreset, selectedResolution, volumeFraction, selectedMaterialId]);

  useEffect(() => {
    setHasStarted(false);
    setViewMode('material');
  }, [resetKey]);

  // Handlers
  const handleStart = useCallback(() => {
    setHasStarted(true);
    start();
  }, [start]);

  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  const handleReset = useCallback(() => {
    setHasStarted(false);
    setViewMode('material');
    reset();
  }, [reset]);

  // Determine display densities
  const displayDensities = hasStarted && state.densities.length > 0 ? state.densities : null;
  const displayStrainEnergy = hasStarted && state.strainEnergy.length > 0 ? state.strainEnergy : null;
  const displayRuptureRisk = hasStarted && state.ruptureRisk.length > 0 ? state.ruptureRisk : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with material info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Soft Material Optimization</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="w-4 h-4" />
          <span>Optimized for artificial muscles &amp; soft robotics</span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
          Error: {error}
        </div>
      )}

      {/* Main visualization */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/5">
        {/* View toggle header */}
        {hasStarted && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
            <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg">
              <button
                onClick={() => setViewMode('material')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'material'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Material
              </button>
              <button
                onClick={() => setViewMode('stress')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'stress'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Stress
              </button>
              <button
                onClick={() => setViewMode('rupture' as ViewMode)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'rupture'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Rupture Risk
              </button>
            </div>

            {/* Stress constraint status */}
            <div className="flex items-center gap-3">
              {stressSummary.passesConstraint ? (
                <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Safe</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Risk</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="relative">
          <Canvas
            densities={viewMode === 'rupture' ? displayRuptureRisk : displayDensities}
            strainEnergy={displayStrainEnergy}
            nelx={nelx}
            nely={nely}
            viewMode={viewMode === 'rupture' ? 'stress' : viewMode}
            supports={bcData.supports}
            loads={bcData.loads}
            initialVolumeFraction={volumeFraction}
            stressColormap={viewMode === 'rupture' ? 'rupture' : 'thermal'}
            presetId={selectedPreset}
          />

          {!isReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="text-sm text-muted-foreground">Initializing...</div>
            </div>
          )}
        </div>
      </div>

      {/* Stress Summary Panel */}
      {hasStarted && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Safety Status */}
          <div className={`p-4 rounded-lg border ${
            stressSummary.passesConstraint
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className={`w-5 h-5 ${
                stressSummary.passesConstraint ? 'text-green-600' : 'text-red-600'
              }`} />
              <span className="font-medium">Safety Status</span>
            </div>
            <div className={`text-2xl font-bold ${
              stressSummary.passesConstraint ? 'text-green-600' : 'text-red-600'
            }`}>
              {stressSummary.minSafetyMargin.toFixed(2)}x
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {getSafetyMarginLabel(stressSummary.minSafetyMargin)}
            </div>
          </div>

          {/* Max Stress */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span className="font-medium">Max Stress</span>
            </div>
            <div className="text-2xl font-bold">
              {formatStress(stressSummary.maxVonMises)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Limit: {formatStress(material.ultimateStress / safetyFactor)}
            </div>
          </div>

          {/* At Risk Elements */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Ruler className="w-5 h-5 text-blue-500" />
              <span className="font-medium">Elements at Risk</span>
            </div>
            <div className={`text-2xl font-bold ${getRuptureRiskClass(stressSummary.elementsAtRisk > 0 ? 0.8 : 0)}`}>
              {stressSummary.elementsAtRisk}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {stressSummary.elementsAtRisk === 0 ? 'No elements near rupture' : 'Elements above 80% stress limit'}
            </div>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {hasStarted && (
        <div className={`p-4 rounded-lg border ${
          stressSummary.passesConstraint
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
        }`}>
          <p className="text-sm">{stressSummary.recommendation}</p>
        </div>
      )}

      {/* Progress Info */}
      <ProgressInfo
        iteration={state.iteration}
        maxIterations={200}
        compliance={state.compliance}
        volume={state.volume}
        change={state.change}
        converged={state.converged}
        isRunning={isRunning}
      />

      {/* Convergence Graphs */}
      {hasStarted && (
        <ConvergenceGraphs
          history={history}
          isRunning={isRunning}
        />
      )}

      {/* Controls */}
      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
        {/* Material Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Soft Material</label>
          <select
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            disabled={hasStarted}
            className="w-full p-2 rounded-md border border-border bg-background text-sm"
          >
            <optgroup label="Silicone Elastomers">
              {SOFT_MATERIALS.filter(m => m.category === 'elastomer' && m.id.includes('ecoflex') || m.id.includes('dragon') || m.id.includes('sylgard')).map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} (Shore {m.shoreHardness}A, {formatStress(m.ultimateStress)} ultimate)
                </option>
              ))}
            </optgroup>
            <optgroup label="TPU / Flexible Plastics">
              {SOFT_MATERIALS.filter(m => m.id.includes('tpu') || m.id.includes('ninja')).map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} (Shore {m.shoreHardness}A, {formatStress(m.ultimateStress)} ultimate)
                </option>
              ))}
            </optgroup>
            <optgroup label="Hydrogels">
              {SOFT_MATERIALS.filter(m => m.category === 'hydrogel').map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({formatStress(m.ultimateStress)} ultimate)
                </option>
              ))}
            </optgroup>
            <optgroup label="Specialty">
              {SOFT_MATERIALS.filter(m => m.category === 'foam' || m.id.includes('hasel')).map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="text-xs text-muted-foreground mt-1">{material.description}</p>
        </div>

        {/* Problem Preset */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Problem Type</label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              disabled={hasStarted}
              className="w-full p-2 rounded-md border border-border bg-background text-sm"
            >
              {PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Resolution</label>
            <select
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value)}
              disabled={hasStarted}
              className="w-full p-2 rounded-md border border-border bg-background text-sm"
            >
              {RESOLUTIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Safety Factor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Safety Factor</label>
            <span className="text-sm text-muted-foreground">{safetyFactor.toFixed(1)}x</span>
          </div>
          <Slider
            value={[safetyFactor]}
            onValueChange={([v]) => setSafetyFactor(v)}
            min={1.0}
            max={4.0}
            step={0.1}
            disabled={hasStarted}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Higher = safer but more material. Recommended: 2.0-3.0 for artificial muscles.
          </p>
        </div>

        {/* Volume Fraction */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Target Volume Fraction</label>
            <span className="text-sm text-muted-foreground">{Math.round(volumeFraction * 100)}%</span>
          </div>
          <Slider
            value={[volumeFraction * 100]}
            onValueChange={([v]) => setVolumeFraction(v / 100)}
            min={20}
            max={80}
            step={5}
            disabled={hasStarted}
          />
        </div>

        {/* Min Wall Thickness */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Min Wall Thickness</label>
            <span className="text-sm text-muted-foreground">{minWallThickness.toFixed(1)} mm</span>
          </div>
          <Slider
            value={[minWallThickness]}
            onValueChange={([v]) => setMinWallThickness(v)}
            min={0.5}
            max={5.0}
            step={0.5}
            disabled={hasStarted}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Minimum manufacturable wall thickness. Critical for preventing rupture.
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-3 pt-2">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              disabled={!isReady}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              {hasStarted ? 'Resume' : 'Start Optimization'}
            </Button>
          ) : (
            <Button
              onClick={handlePause}
              variant="outline"
              className="flex-1"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={isRunning}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Material Properties Reference */}
      <details className="p-4 bg-muted/20 rounded-lg border border-border">
        <summary className="text-sm font-medium cursor-pointer">
          Material Properties: {material.name}
        </summary>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Ultimate Stress:</span>
            <div className="font-medium">{formatStress(material.ultimateStress)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Max Strain:</span>
            <div className="font-medium">{(material.ultimateTensileStrain * 100).toFixed(0)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Shore Hardness:</span>
            <div className="font-medium">{material.shoreHardness}A</div>
          </div>
          <div>
            <span className="text-muted-foreground">Density:</span>
            <div className="font-medium">{material.density} kg/m³</div>
          </div>
          <div>
            <span className="text-muted-foreground">Young&apos;s Modulus:</span>
            <div className="font-medium">{formatStress(material.youngsModulus)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Tear Strength:</span>
            <div className="font-medium">{material.tearStrength} kN/m</div>
          </div>
          <div>
            <span className="text-muted-foreground">Printable:</span>
            <div className="font-medium">{material.printable ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Cost:</span>
            <div className="font-medium">${material.costPerKg}/kg</div>
          </div>
        </div>
        <div className="mt-3 text-sm">
          <span className="text-muted-foreground">Applications: </span>
          <span>{material.applications.join(', ')}</span>
        </div>
      </details>
    </div>
  );
}

export default SoftMaterialsTab;
