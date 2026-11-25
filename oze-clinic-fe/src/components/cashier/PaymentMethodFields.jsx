import SegmentedControl from "@/components/ui/SegmentedControl";
import { METHOD, PAY_METHODS } from "@/utils/cashier";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";

const OPTIONS = PAY_METHODS.map((value) => ({ value, label: TEXT.METHODS[value] }));

const PaymentMethodFields = ({ idPrefix, method, onMethod, reference, onReference, note, onNote }) => (
    <div className="grid gap-4 md:grid-cols-2">
        <div className="field md:col-span-2">
            <span className="label">{TEXT.METHOD}</span>
            <SegmentedControl label={TEXT.METHOD} options={OPTIONS} value={method} onChange={onMethod} className="self-start" />
        </div>
        {method !== METHOD.CASH && (
            <div className="field">
                <label htmlFor={`${idPrefix}-ref`} className="label">
                    {TEXT.REF}
                </label>
                <input id={`${idPrefix}-ref`} className="input" maxLength={100} placeholder={TEXT.REF_PLACEHOLDER} value={reference} onChange={(e) => onReference(e.target.value)} />
            </div>
        )}
        <div className={method === METHOD.CASH ? "field md:col-span-2" : "field"}>
            <label htmlFor={`${idPrefix}-note`} className="label">
                {TEXT.NOTE}
            </label>
            <input id={`${idPrefix}-note`} className="input" maxLength={500} value={note} onChange={(e) => onNote(e.target.value)} />
        </div>
    </div>
);

export default PaymentMethodFields;
