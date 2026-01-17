import { TopologyVisualizer } from '@/components/visualization/TopologyVisualizer';
import { Introduction } from '@/components/content/Introduction';
import { HowItWorks } from '@/components/content/HowItWorks';
import { UnderstandingControls } from '@/components/content/UnderstandingControls';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Article Container */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* Header with Theme Toggle */}
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
                Topology Optimization
              </h1>
              <p className="text-xl text-muted-foreground">
                How computers design structures by learning from nature
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>
        
        {/* Divider */}
        <hr className="border-border mb-8" />
        
        {/* Introduction */}
        <Introduction />
        
        {/* Divider */}
        <hr className="border-border my-10" />
        
        {/* Interactive Demo Section */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Try It Yourself
          </h2>
          <p className="text-muted-foreground mb-6">
            Watch the optimization happen in real-time. Click &quot;Start&quot; to begin, and experiment 
            with different problems and settings.
          </p>
          
          <TopologyVisualizer className="mb-8" />
        </section>
        
        {/* Divider */}
        <hr className="border-border my-10" />
        
        {/* How It Works */}
        <HowItWorks />
        
        {/* Divider */}
        <hr className="border-border my-10" />
        
        {/* Understanding Controls */}
        <UnderstandingControls />
        
        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              This interactive demonstration uses the SIMP (Solid Isotropic Material with Penalization) 
              method, a widely-used topology optimization algorithm developed in the 1980s and 1990s.
            </p>
            <p>
              The algorithm runs entirely in your browser using JavaScript. No data is sent to any server.
            </p>
          </div>
        </footer>
        
      </article>
    </main>
  );
}
