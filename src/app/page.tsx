import { TopologyVisualizer } from '@/components/visualization/TopologyVisualizer';
import { ThemeToggle } from '@/components/ThemeToggle';

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
        
        {/* Visualizer */}
        <TopologyVisualizer />
        
      </article>
    </main>
  );
}
