import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_UPDATED_AT, PRIVACY_POLICY, TERMS_OF_USE } from "@/utils/legalContent";
import { ROUTES } from "@/utils/routes";

const PrivacyPolicyPage = () => (
    <LegalDocument
        {...PRIVACY_POLICY}
        updatedAt={LEGAL_UPDATED_AT}
        related={{ label: TERMS_OF_USE.title, href: ROUTES.TERMS_OF_USE }}
    />
);

export default PrivacyPolicyPage;
