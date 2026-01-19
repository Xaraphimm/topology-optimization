'use client';

import { useState, useMemo } from 'react';
import {
  MATERIALS,
  getMaterial,
  calculateSavings,
  formatMass,
  formatCost,
  type Dimensions,
  type Material,
  type SavingsResult,
} from '@/lib/material-savings';

interface MaterialSavingsCalculatorProps {
  volumeFraction: number;
  className?: string;
}

/**
 * Material Savings Calculator
 * 
 * Shows how much material, weight, and cost is saved through topology optimization.
 * Allows users to input custom dimensions and select different materials.
 */
export function MaterialSavingsCalculator({
  volumeFraction,
  className = '',
}: MaterialSavingsCalculatorProps) {
  // Dimensions state (in mm for user input, converted to m for calculations)
  const [lengthMm, setLengthMm] = useState(300);  // 300mm = 30cm
  const [widthMm, setWidthMm] = useState(100);    // 100mm = 10cm
  const [heightMm, setHeightMm] = useState(50);   // 50mm = 5cm
  
  // Selected material
  const [selectedMaterialId, setSelectedMaterialId] = useState('aluminum-6061');
  
  // Show/hide advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Convert mm to m for calculations
  const dimensions: Dimensions = useMemo(() => ({
    length: lengthMm / 1000,
    width: widthMm / 1000,
    height: heightMm / 1000,
  }), [lengthMm, widthMm, heightMm]);
  
  // Calculate savings
  const savings: SavingsResult | null = useMemo(() => {
    const material = getMaterial(selectedMaterialId);
    if (!material) return null;
    return calculateSavings(volumeFraction, dimensions, material);
  }, [volumeFraction, dimensions, selectedMaterialId]);
  
  // Calculate comparison for key materials
  const materialComparison = useMemo(() => {
    const keyMaterials = ['aluminum-6061', 'steel-1018', 'titanium-6al4v'];
    return keyMaterials
      .map(id => {
        const material = getMaterial(id);
        if (!material) return null;
        const result = calculateSavings(volumeFraction, dimensions, material);
        return {
          id,
          name: material.name.split(' ')[0], // Short name
          fullName: material.name,
          massSaved: result.massSaved,
          costSaved: result.costSaved,
          optimizedMass: result.optimizedMass,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [volumeFraction, dimensions]);
  
  const materialSavedPercent = (1 - volumeFraction) * 100;
  const massReductionRatio = volumeFraction > 0 ? 1 / volumeFraction : 0;
  
  // Group materials by category
  const metalMaterials = MATERIALS.filter(m => m.category === 'metal');
  const polymerMaterials = MATERIALS.filter(m => m.category === 'polymer');
  const compositeMaterials = MATERIALS.filter(m => m.category === 'composite');
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main stats card */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Material Savings
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Topology optimization reduces material usage while maintaining structural integrity
            </p>
          </div>
        </div>
        
        {/* Big savings number */}
        <div className="flex items-center gap-6 mb-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
              {materialSavedPercent.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Material Saved</div>
          </div>
          <div className="h-16 w-px bg-border" />
          <div className="text-center">
            <div className="text-2xl font-semibold text-foreground">
              {massReductionRatio.toFixed(1)}x
            </div>
            <div className="text-sm text-muted-foreground">Lighter</div>
          </div>
          <div className="h-16 w-px bg-border" />
          <div className="text-center">
            <div className="text-2xl font-semibold text-foreground">
              {(volumeFraction * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Material Used</div>
          </div>
        </div>
        
        {/* Quick comparison of key materials */}
        <div className="grid grid-cols-3 gap-3">
          {materialComparison.map((m) => (
            <div
              key={m.id}
              className="bg-white/60 dark:bg-white/5 rounded-lg p-3 text-center"
            >
              <div className="text-xs text-muted-foreground mb-1">{m.name}</div>
              <div className="font-semibold text-foreground">{formatMass(m.massSaved)}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">
                saved ({formatCost(m.costSaved)})
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Advanced settings toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        aria-label={showAdvanced ? 'Hide custom dimensions and materials' : 'Show custom dimensions and materials'}
        aria-expanded={showAdvanced}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {showAdvanced ? 'Hide' : 'Show'} custom dimensions & materials
      </button>
      
      {/* Advanced settings panel */}
      {showAdvanced && (
        <div className="space-y-4 bg-muted/30 rounded-xl p-4 border border-border">
          {/* Dimensions input */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Part Dimensions (mm)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Length</label>
                <input
                  type="number"
                  value={lengthMm}
                  onChange={(e) => setLengthMm(Math.max(1, Number(e.target.value)))}
                  placeholder="300"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  min={1}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Width</label>
                <input
                  type="number"
                  value={widthMm}
                  onChange={(e) => setWidthMm(Math.max(1, Number(e.target.value)))}
                  placeholder="100"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  min={1}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Height</label>
                <input
                  type="number"
                  value={heightMm}
                  onChange={(e) => setHeightMm(Math.max(1, Number(e.target.value)))}
                  placeholder="50"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  min={1}
                />
              </div>
            </div>
          </div>
          
          {/* Material selection */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Material
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <optgroup label="Metals">
                {metalMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.density.toLocaleString()} kg/m³)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Polymers">
                {polymerMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.density.toLocaleString()} kg/m³)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Composites">
                {compositeMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.density.toLocaleString()} kg/m³)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          
          {/* Detailed results */}
          {savings && (
            <div className="bg-background/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-foreground text-sm">
                {savings.material.name} Analysis
              </h4>
              <p className="text-xs text-muted-foreground">
                {savings.material.description}
              </p>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Solid Block
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mass:</span>
                      <span className="font-medium">{formatMass(savings.solidMass)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium">{formatCost(savings.solidCost)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Optimized
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mass:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formatMass(savings.optimizedMass)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCost(savings.optimizedCost)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Total Savings:</span>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMass(savings.massSaved)}
                    </span>
                    <span className="text-muted-foreground mx-2">/</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCost(savings.costSaved)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MaterialSavingsCalculator;
