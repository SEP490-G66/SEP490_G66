import { useState } from "react";
import useAsync from "@/hooks/useAsync";
import { getMyMedicalBook } from "@/services/medicalBookService";
import { BOOKING_ERROR_CODE } from "@/utils/messages";

// The patient's medical book (visits, treatment plans, films, history) for the "Sức khoẻ" pages.
// status: "loading" | "failed" | "unlinked" | "ready".
const useMedicalBook = () => {
    const [version, setVersion] = useState(0);
    const { loading, error, value } = useAsync(() => getMyMedicalBook(), [version]);
    let status = "ready";
    if (loading) status = "loading";
    else if (!error && value?.code === BOOKING_ERROR_CODE.PROFILE_NOT_FOUND) status = "unlinked";
    else if (error || !value?.success || !value.data) status = "failed";
    return { status, data: status === "ready" ? value.data : null, reload: () => setVersion((current) => current + 1) };
};

export default useMedicalBook;
