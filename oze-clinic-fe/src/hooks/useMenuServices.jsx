import { useEffect, useState } from "react";
import { loadMenuServices } from "@/services/dentalService";

// The services of the header "Dịch vụ" menu, read from the database; null while they load
export default function useMenuServices() {
    const [services, setServices] = useState(null);

    useEffect(() => {
        let active = true;
        loadMenuServices().then((list) => active && setServices(list));
        return () => {
            active = false;
        };
    }, []);

    return services;
}
