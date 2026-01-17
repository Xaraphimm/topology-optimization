import { Callout } from './Callout';

export function Introduction() {
  return (
    <section className="prose max-w-none">
      <p className="text-lg text-muted-foreground leading-relaxed">
        Have you ever wondered why bones are hollow, or why trees have the shape they do? 
        Nature has spent millions of years figuring out the most efficient ways to build 
        strong structures using the least amount of material. <strong className="text-foreground">Topology optimization</strong> is 
        a computer technique that does the same thing—it finds the best shape for a structure 
        by removing material that isn&apos;t doing much work.
      </p>
      
      <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
        What is Topology Optimization?
      </h2>
      
      <p className="text-muted-foreground">
        Imagine you&apos;re designing a bracket that needs to hold a heavy shelf. You could start 
        with a solid block of metal, but that would be wasteful—most of that material isn&apos;t 
        actually helping support the shelf. Topology optimization starts with that solid block 
        and systematically removes material from areas where it&apos;s not needed, leaving behind 
        only the essential structure.
      </p>
      
      <p className="text-muted-foreground">
        The result often looks surprisingly organic—similar to bones, coral, or tree branches. 
        This isn&apos;t a coincidence. Both nature and topology optimization are solving the same 
        problem: how to be strong while using as little material as possible.
      </p>
      
      <Callout title="Key Idea" type="tip">
        Topology optimization doesn&apos;t just make things lighter—it makes them <em>efficiently</em> light. 
        The algorithm keeps material exactly where it&apos;s needed to carry loads and removes it 
        everywhere else.
      </Callout>
      
      <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
        Where is it Used?
      </h2>
      
      <p className="text-muted-foreground">
        This technique is used across many industries:
      </p>
      
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">Aerospace:</strong> Aircraft and spacecraft need to be as light as possible 
          while remaining strong. Topology-optimized parts can reduce weight by 40% or more.
        </li>
        <li>
          <strong className="text-foreground">Automotive:</strong> Lighter cars use less fuel. Many car manufacturers use 
          topology optimization for suspension components, brackets, and structural parts.
        </li>
        <li>
          <strong className="text-foreground">3D Printing:</strong> Traditional manufacturing has limits on what shapes you 
          can make. 3D printing can produce the complex organic shapes that topology optimization 
          creates, making them a perfect match.
        </li>
        <li>
          <strong className="text-foreground">Medical Implants:</strong> Hip replacements and other implants can be designed 
          to match the stiffness of bone, reducing stress on the surrounding tissue.
        </li>
      </ul>
    </section>
  );
}

export default Introduction;
