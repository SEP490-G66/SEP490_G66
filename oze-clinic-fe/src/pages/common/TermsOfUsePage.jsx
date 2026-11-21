import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_UPDATED_AT, PRIVACY_POLICY, TERMS_OF_USE } from "@/utils/legalContent";
import { ROUTES } from "@/utils/routes";

const TermsOfUsePage = () => (
    <LegalDocument
        {...TERMS_OF_USE}
        updatedAt={LEGAL_UPDATED_AT}
        related={{ label: PRIVACY_POLICY.title, href: ROUTES.PRIVACY_POLICY }}
    />
);

export default TermsOfUsePage;
