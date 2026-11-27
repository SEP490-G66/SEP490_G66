import { useEffect, useState } from "react";
import { getPlanDoctorOptions } from "@/services/examinationService";

// Doctors a session of this service can be given to (see getPlanDoctorOptions); [] while loading or when serviceId is null
const usePlanDoctorOptions = (serviceId) => {
    const [loaded, setLoaded] = useState({ key: null, items: [] });

    useEffect(() => {
        if (serviceId == null) return undefined;
        let active = true;
        getPlanDoctorOptions(serviceId).then((items) => active && setLoaded({ key: serviceId, items }));
        return () => {
            active = false;
        };
    }, [serviceId]);

    return loaded.key === serviceId ? loaded.items : [];
};

export default usePlanDoctorOptions;
