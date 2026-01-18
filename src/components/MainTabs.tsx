'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TopologyVisualizer } from '@/components/visualization/TopologyVisualizer';
import { SoftMaterialsTab } from '@/components/visualization/SoftMaterialsTab';
import { Layers, Beaker } from 'lucide-react';

/**
 * Main application tabs
 *
 * Provides switching between:
 * - Standard Materials: Traditional SIMP optimization for metals/polymers
 * - Soft Materials: Stress-constrained optimization for elastomers/artificial muscles
 */
export function MainTabs() {
  return (
    <Tabs defaultValue="standard" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
        <TabsTrigger value="standard" className="flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <span>Standard Materials</span>
        </TabsTrigger>
        <TabsTrigger value="soft" className="flex items-center gap-2">
          <Beaker className="w-4 h-4" />
          <span>Soft Materials</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="standard">
        <TopologyVisualizer />
      </TabsContent>

      <TabsContent value="soft">
        <SoftMaterialsTab />
      </TabsContent>
    </Tabs>
  );
}

export default MainTabs;
