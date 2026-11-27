import { useEffect } from "react";

// Wires an exam step to the visit header (ExaminationPage): the header's "Lưu nháp" runs save (-> { success, message? })
// and the step's autosave status is shown under the header's buttons. draft: { saveRef, onStatus } from the page.
const useExamDraft = (draft, save, status) => {
    useEffect(() => {
        if (!draft) return undefined;
        const ref = draft.saveRef;
        ref.current = save;
        return () => {
            if (ref.current === save) ref.current = null;
        };
    });

    const onStatus = draft?.onStatus;
    useEffect(() => {
        onStatus?.(status);
    }, [onStatus, status]);
};

export default useExamDraft;
