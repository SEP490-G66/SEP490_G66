import { ACTION } from "@/utils/cashier";
import { ROUTES, getCashierOptionRoute, getCashierRoute } from "@/utils/routes";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";
import { money, dmy } from "@/components/reception/receptionUtils";

// Where the main button of a plan card goes, and the line under the plan name (R9)
export const actionOf = (patientId, plan) => {
    const periods = getCashierRoute(ROUTES.RECEPTION_PERIODS, { patient: patientId, plan: plan.id });
    switch (plan.action) {
        case ACTION.CHOOSE:
            return { label: TEXT.ACTIONS.CHOOSE, to: getCashierOptionRoute(patientId, plan.id), line: TEXT.ACTION_LINE.CHOOSE };
        case ACTION.DEPOSIT:
            return {
                label: TEXT.ACTIONS.DEPOSIT,
                to: getCashierRoute(ROUTES.RECEPTION_DEPOSITS, { patient: patientId, plan: plan.id }),
                line: TEXT.ACTION_LINE.DEPOSIT(money(plan.depositToPay)),
            };
        case ACTION.FULL:
            return {
                label: TEXT.ACTIONS.FULL,
                to: getCashierRoute(ROUTES.RECEPTION_COLLECT, { patient: patientId, add: `full:${plan.id}` }),
                line: TEXT.ACTION_LINE.FULL(money(plan.fullCeiling)),
            };
        case ACTION.COLLECT:
            return {
                label: TEXT.ACTIONS.COLLECT,
                to: getCashierRoute(ROUTES.RECEPTION_COLLECT, { patient: patientId, add: `period:${plan.nextPeriod.id}` }),
                line: TEXT.ACTION_LINE.COLLECT(plan.nextPeriod.seq, dmy(plan.nextPeriod.date)),
            };
        default: {
            const line = plan.pending > 0 ? TEXT.PLAN_SUMMARY.PENDING : plan.hasUnfinished ? TEXT.PLAN_SUMMARY.NOT_YET : TEXT.PLAN_SUMMARY.PAID;
            return { label: TEXT.ACTIONS.VIEW, to: periods, line };
        }
    }
};
