import { PageForm } from "../PageForm";

export default function NewPagePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-ink">Nueva página</h1>
      <PageForm initial={{ title: "", slug: "", content: "", enabled: true, showInFooter: true, showInMenu: true, showContactForm: false, sortOrder: 10, seoDescription: "" }} />
    </div>
  );
}
