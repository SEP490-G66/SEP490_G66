import api from "./api";
import { call } from "./receptionService";

export const getDailyReconciliation = (date, config = {}) => call(() => api.get("/api/reconciliations/daily", { ...config, params: { date } }));
