import { Callout } from './Callout';

export function HowItWorks() {
  return (
    <section className="prose max-w-none">
      <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
        How Does It Work?
      </h2>
      
      <p className="text-muted-foreground">
        The algorithm works by repeatedly asking a simple question: <em>&quot;Which parts of this 
        structure are working the hardest?&quot;</em> Material in high-stress areas is kept, while 
        material in low-stress areas is gradually removed.
      </p>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Step 1: Start with a Solid Block
      </h3>
      <p className="text-muted-foreground">
        The optimization begins with the entire design space filled with material. Think of it 
        as a block of clay that we&apos;re going to carve into the optimal shape.
      </p>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Step 2: Apply Forces and Supports
      </h3>
      <p className="text-muted-foreground">
        We tell the computer where the structure is attached (the supports) and where forces 
        are applied (the loads). This defines the problem we&apos;re trying to solve.
      </p>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Step 3: Calculate Stresses
      </h3>
      <p className="text-muted-foreground">
        The computer simulates how the structure would deform under the applied loads. This 
        reveals which areas are under high stress (working hard) and which areas are under 
        low stress (not contributing much).
      </p>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Step 4: Redistribute Material
      </h3>
      <p className="text-muted-foreground">
        Based on the stress analysis, the algorithm moves material from low-stress areas to 
        high-stress areas. Areas with very low stress gradually become empty (shown as white 
        in the visualization).
      </p>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Step 5: Repeat Until Done
      </h3>
      <p className="text-muted-foreground">
        Steps 3 and 4 are repeated many times. With each iteration, the structure becomes 
        more refined. The algorithm stops when changes between iterations become very small—this 
        means it has found a stable, optimal design.
      </p>
      
      <Callout title="Why the Organic Shapes?" type="info">
        The diagonal braces and curved shapes you see aren&apos;t designed by a human—they emerge 
        naturally from the optimization process. These shapes are efficient because they 
        align material along the directions where forces flow through the structure, similar 
        to how the grain in wood follows the tree&apos;s natural stress patterns.
      </Callout>
      
      <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
        Understanding the Visualization
      </h2>
      
      <p className="text-muted-foreground">
        In the interactive demo above, you can watch the optimization happen in real-time:
      </p>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Material View (Default)
      </h3>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">Black areas</strong> represent solid material—these regions are working hard 
          to carry the load.
        </li>
        <li>
          <strong className="text-foreground">White areas</strong> represent empty space—material has been removed because 
          it wasn&apos;t contributing to the structure&apos;s strength.
        </li>
        <li>
          <strong className="text-foreground">Gray areas</strong> are intermediate—the algorithm is still deciding whether 
          to keep or remove material there. As the optimization progresses, these become more 
          black or white.
        </li>
      </ul>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Stress View
      </h3>
      <p className="text-muted-foreground">
        Click the <strong className="text-foreground">&quot;Stress&quot;</strong> button to see <em>why</em> material is being 
        removed. This view shows the strain energy in each element:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">Blue areas</strong> have low strain energy—they&apos;re not doing much work, 
          so the algorithm removes material here.
        </li>
        <li>
          <strong className="text-foreground">Red areas</strong> have high strain energy—they&apos;re working hard to 
          resist the load, so material is kept or added here.
        </li>
        <li>
          <strong className="text-foreground">White areas</strong> are in between.
        </li>
      </ul>
      
      <Callout title="Try Switching Views" type="tip">
        Toggle between Material and Stress views while the optimization runs. You&apos;ll see 
        that blue (low stress) areas in the stress view correspond to white (void) areas in 
        the material view. This is the algorithm in action—removing material where it isn&apos;t needed.
      </Callout>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Boundary Conditions
      </h3>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">Blue triangles</strong> show where the structure is supported (fixed in place).
        </li>
        <li>
          <strong className="text-foreground">Red arrows</strong> show where forces are applied.
        </li>
      </ul>
    </section>
  );
}

export default HowItWorks;
