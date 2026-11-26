import { useEffect, useState } from "react";
import { loadMenuServices } from "@/services/dentalService";

// The services of the header "Dịch vụ" menu, read from the database
export default function useMenuServices() {
    const [services, setServices] = useState([]);

    useEffect(() => {
        let active = true;
        loadMenuServices().then((list) => active && setServices(list));
        return () => {
            active = false;
        };
    }, []);

    return services;
}
