import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPage } from "@/lib/pages";
import { getSiteSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/siteUrl";
import { ContactForm } from "./ContactForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPublicPage((await params).slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.seoDescription || page.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || undefined,
    alternates: { canonical: `${siteUrl()}/pagina/${page.slug}` },
  };
}

export default async function InfoPage({ params }: Props) {
  const page = await getPublicPage((await params).slug);
  if (!page) notFound();
  const settings = page.showContactForm ? await getSiteSettings() : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-brand-ink">{page.title}</h1>
      <div
        className="prose prose-sm mt-6 max-w-none text-brand-ink/85 [&_a]:text-brand-pink-dark [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_img]:rounded-lg [&_li]:my-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_ul]:ml-5 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
      {settings && (
        <>
          <ul className="mt-6 space-y-1 text-sm text-brand-muted">
            {settings.contactEmail && <li>Email: <a className="text-brand-pink-dark hover:underline" href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></li>}
            {settings.address && <li>Dirección: {settings.address}</li>}
          </ul>
          <ContactForm />
        </>
      )}
    </div>
  );
}
