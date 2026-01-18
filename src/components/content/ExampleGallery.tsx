'use client';

/**
 * Example Gallery - Real-world topology optimization applications
 * 
 * Shows practical examples with recommended settings to help users
 * understand how topology optimization is used in industry.
 */

interface Example {
  id: string;
  title: string;
  description: string;
  industry: string;
  recommendedPreset: string;
  recommendedVolume: number;
  keyInsight: string;
}

const EXAMPLES: Example[] = [
  {
    id: 'aerospace-bracket',
    title: 'Aerospace Bracket',
    description: 'Aircraft mounting brackets that need to be as light as possible while handling flight loads.',
    industry: 'Aerospace',
    recommendedPreset: 'cantilever',
    recommendedVolume: 30,
    keyInsight: 'Aerospace parts often use 25-35% volume fraction to maximize weight savings.',
  },
  {
    id: 'automotive-suspension',
    title: 'Suspension Arm',
    description: 'Automotive control arms that transfer forces between wheels and chassis.',
    industry: 'Automotive',
    recommendedPreset: 'bridge',
    recommendedVolume: 40,
    keyInsight: 'Automotive parts balance weight savings with durability, typically 35-45% volume.',
  },
  {
    id: 'structural-beam',
    title: 'Structural Beam',
    description: 'Building support beams that carry distributed loads across their span.',
    industry: 'Civil Engineering',
    recommendedPreset: 'mbb',
    recommendedVolume: 50,
    keyInsight: 'The MBB beam is a classic test case showing how diagonal bracing naturally emerges.',
  },
  {
    id: '3d-printed-part',
    title: '3D Printed Part',
    description: 'Custom fixtures and brackets designed for additive manufacturing.',
    industry: '3D Printing',
    recommendedPreset: 'cantilever',
    recommendedVolume: 35,
    keyInsight: '3D printing can produce the complex organic shapes that topology optimization creates.',
  },
];

export function ExampleGallery() {
  return (
    <div className="my-8">
      <h3 className="text-xl font-semibold text-foreground mb-4">
        Real-World Applications
      </h3>
      <p className="text-muted-foreground mb-6">
        Topology optimization is used across many industries. Here are some common applications 
        with recommended settings to try:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXAMPLES.map((example) => (
          <div
            key={example.id}
            className="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-foreground">{example.title}</h4>
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                {example.industry}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {example.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
              <span>
                Preset: <span className="font-medium text-foreground capitalize">{example.recommendedPreset}</span>
              </span>
              <span>
                Volume: <span className="font-medium text-foreground">{example.recommendedVolume}%</span>
              </span>
            </div>
            <p className="text-xs text-primary/80 italic">
              {example.keyInsight}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExampleGallery;
