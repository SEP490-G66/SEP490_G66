import { saveMedicalHistory } from "@/services/examinationService";
import useAutosave from "./useAutosave";

// Medical history edited by the doctor (step 1), saved to the patient's record after each change.
// onSaved receives the items the record now has, by group ({ allergies, conditions, dental }).
export default function useHistoryAutosave(queueId, initialHistory, onChange, onSaved) {
    const save = async (history) => {
        const response = await saveMedicalHistory(queueId, history);
        if (response.success && response.data?.saved) onSaved?.(response.data.saved);
        return response;
    };
    const { value, setValue, statusText } = useAutosave(save, initialHistory, onChange);
    return { history: value, setHistory: setValue, statusText };
}
