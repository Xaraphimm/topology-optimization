import { TopologyVisualizer } from '@/components/visualization/TopologyVisualizer';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SIMPExplainer } from '@/components/content/SIMPExplainer';
import { ExampleGallery } from '@/components/content/ExampleGallery';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Topology Optimization
              </h1>
              <p className="text-sm text-muted-foreground">
                Interactive SIMP algorithm visualization
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>
        
        {/* Brief Introduction */}
        <div className="max-w-3xl mb-6">
          <p className="text-muted-foreground leading-relaxed">
            Topology optimization finds the most efficient structure by removing material where 
            it isn&apos;t needed. Watch the algorithm work in real-time—black areas are solid material 
            carrying loads, white areas are voids. Click <strong className="text-foreground">Start</strong> to 
            see structures evolve from uniform blocks into optimized forms.
          </p>
        </div>
        
        {/* Interactive Visualizer */}
        <TopologyVisualizer />
        
        {/* SIMP Material Model Explainer */}
        <div className="max-w-3xl mx-auto mt-12">
          <SIMPExplainer />
        </div>
        
        {/* Example Gallery */}
        <div className="max-w-3xl mx-auto mt-8">
          <ExampleGallery />
        </div>
        
        {/* What to Watch */}
        <div className="max-w-3xl mx-auto mt-8 mb-8">
          <div className="p-4 sm:p-5 bg-muted/30 rounded-lg border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              What to Watch
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-foreground/50 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Early iterations (1-20):</strong>{' '}
                  Noisy with lots of gray as the algorithm explores possibilities
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/50 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Mid iterations (20-60):</strong>{' '}
                  Clear structures crystallize as gray resolves to black or white
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/50 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Convergence:</strong>{' '}
                  Compliance decreases and density change approaches zero—optimization complete
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/50 mt-0.5">•</span>
                <span>
                  <strong className="text-foreground">Diagonal bracing:</strong>{' '}
                  Forces flow along diagonal paths—the most efficient way to transfer loads
                </span>
              </li>
            </ul>
          </div>
        </div>
        
      </article>
    </main>
  );
}
