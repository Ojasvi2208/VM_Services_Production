// Shared editorial prose block used to add substantive content to thin pages
// that previously failed AdSense's "Low Value Content" classifier. Drops into
// any page with the existing Obsidian/Emerald dark theme chrome.
import type { ReactNode } from 'react';

export function EditorialProse({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
      <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-[#dce5df] mb-6">
        {heading}
      </h2>
      <div
        className="prose-dark text-[#c0c9c2] leading-relaxed
          [&_p]:text-[0.95rem] [&_p]:text-[#c0c9c2] [&_p]:leading-relaxed [&_p]:mb-4
          [&_strong]:text-[#dce5df] [&_strong]:font-semibold
          [&_ul]:space-y-2 [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc
          [&_ol]:space-y-2 [&_ol]:mb-4 [&_ol]:pl-5 [&_ol]:list-decimal
          [&_li]:text-[0.95rem] [&_li]:text-[#c0c9c2]
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#dce5df] [&_h3]:mt-6 [&_h3]:mb-3
          [&_a]:text-[#44f593] [&_a]:underline"
      >
        {children}
      </div>
    </section>
  );
}
