import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import PatientAdminFields from "@/components/reception/PatientAdminFields";
import PatientHistoryFields from "@/components/reception/PatientHistoryFields";
import { Card } from "@/components/reception/shared";
import { useDebounced, useFocusOnEnter, useLeaveGuard, useLoadGuard, usePageTitle, usePatientRecordNav } from "@/hooks/usePatientRecordNav";
import { addMedicalProfile, clinicToday, createPatient, getPatient, getPatients, updatePatient } from "@/services/receptionService";
import { getSessionToken } from "@/services/sessionStore";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import {
    clinicDateOf,
    historyKey,
    idKey,
    isCompactPhone,
    isValidPhone,
    missingHistory,
    phoneVariants,
    readPatientId,
    safeListSearch,
    subscriberDigits,
} from "@/utils/patientRecord";
import { BE_MESSAGES, errorText, fieldErrorsOf, fieldOfMessage, hasMessage, isPatientGone, isUncertain } from "@/utils/patientRecordErrors";
import {
    ADMIN_FIELDS,
    accountChanged,
    addToStamp,
    adminChanged,
    adminLockOf,
    bodyMatches,
    createBody,
    dropFemaleOnly,
    emptyForm,
    emptyHistory,
    formFromPatient,
    historyFromItems,
    historyGroups,
    needsPhoneFix,
    sameStamp,
    stampOf,
    updateBody,
    validateForm,
    wantedHistory,
} from "@/utils/patientRecordForm";
import { WAIT_MS, carry, drafts, isOwnerSignedIn, latestDraft, notifyPatientRecord, saving } from "@/utils/patientRecordStore";
import { RECEPTION_PATIENT_CREATE_ROUTE, ROUTES, getReceptionPatientEditRoute, getReceptionPatientRoute } from "@/utils/routes";

const READ = { skipErrorPage: true };
const DUP_DELAY_MS = 400;
const WAIT_STEP_MS = 300;
const LOOKUP_PAGE_SIZE = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nameKey = (name) => historyKey("name", name);

const draftPrompt = (attemptId) => {
    const own = attemptId ? drafts.get(attemptId) : null;
    if (own) return { id: attemptId, entry: own, others: 0 };
    const { entry, others } = latestDraft();
    return entry ? { id: entry[0], entry: entry[1], others } : null;
};

const freshForm = (key, mode, attemptId) => ({
    key,
    patientId: null,
    values: emptyForm(),
    baseline: emptyForm(),
    edited: [],
    seen: [],
    ticked: emptyHistory(),
    errors: {},
    original: null,
    stamp: stampOf(null),
    alert: null,
    conflict: null,
    notice: null,
    dup: null,
    ownDup: null,
    forceBlood: false,
    attemptId: attemptId ?? `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uncertainCreate: false,
    draft: mode === "create" ? draftPrompt(attemptId) : null,
});

const fromPatient = (form, patient, { keepTicked = true } = {}) => ({
    ...form,
    patientId: patient.id,
    values: formFromPatient(patient),
    baseline: formFromPatient(patient),
    edited: [],
    seen: [],
    errors: {},
    original: patient,
    stamp: stampOf(patient),
    conflict: null,
    dup: null,
    ownDup: needsPhoneFix(patient) ? { status: "loading" } : null,
    ticked: keepTicked ? form.ticked : emptyHistory(),
});

const lookupByPhone = (subscriber, config) => getPatients({ keyword: subscriber, pageSize: LOOKUP_PAGE_SIZE }, config);

const ownDupOf = async (patient) => {
    const subscriber = subscriberDigits(patient.phoneNumber);
    const result = await lookupByPhone(subscriber, READ);
    if (!result.success) return { status: "error" };
    const variants = phoneVariants(subscriber);
    const match = (result.data?.items ?? []).find((p) => Number(p.id) !== Number(patient.id) && variants.includes(p.phoneNumber));
    return { status: "ready", match: match ?? null };
};

const focusField = (field) => {
    const target = document.getElementById(`pf-${field}`);
    target?.focus();
};

const ReceptionPatientForm = () => {
    const { patientId: rawId } = useParams();
    const navigate = useNavigate();
    const [load, setLoad] = useState(null);
    const nav = usePatientRecordNav({ failed: Boolean(load && load.status === "error") });
    const { loadKey, kind, navigateSelf, location } = nav;
    const routeMode = rawId === undefined ? "create" : "edit";
    const idInfo = routeMode === "edit" ? readPatientId(rawId) : null;
    const [req, setReq] = useState(() => ({ key: loadKey, mode: routeMode, id: idInfo?.id ?? null, retry: 0, attemptId: location.state?.attemptId }));
    const [form, setForm] = useState(() => freshForm(loadKey, routeMode, location.state?.attemptId));
    const [run, setRun] = useState(null);
    const h1Ref = useFocusOnEnter(loadKey, kind);
    const alertRef = useRef(null);
    const formRef = useRef(form);
    const dupController = useRef(null);
    const normalized = useRef(null);
    const isHere = useLoadGuard(loadKey);
    const dupTimer = useDebounced(DUP_DELAY_MS);

    let request = req;
    let current = form;
    if (req.key !== loadKey) {
        request = { key: loadKey, mode: routeMode, id: idInfo?.id ?? null, retry: 0, attemptId: location.state?.attemptId };
        current = freshForm(loadKey, routeMode, location.state?.attemptId);
        setReq(request);
        setForm(current);
    }

    const mode = current.patientId ? "edit" : request.mode;
    const patientId = current.patientId ?? request.id;
    const sending = run?.key === loadKey;
    const today = clinicToday();
    const loadCurrent = load?.key === `${request.key}|${request.retry}` ? load : null;

    useEffect(() => {
        formRef.current = form;
    });

    useEffect(() => {
        if (current.alert) alertRef.current?.focus();
    }, [current.alert]);

    const patch = (key, update) => {
        if (!isHere(key)) return;
        setForm((f) => (f.key === key ? { ...f, ...(typeof update === "function" ? update(f) : update) } : f));
    };

    usePageTitle(mode === "edit" ? TEXT.DOC_TITLE_EDIT(current.original?.fullName ?? "") : TEXT.DOC_TITLE_CREATE);

    useEffect(() => {
        if (request.mode !== "edit" || !idInfo?.fixed || normalized.current === loadKey) return;
        normalized.current = loadKey;
        navigateSelf(getReceptionPatientEditRoute(idInfo.id), { replace: true });
    }, [request.mode, idInfo, loadKey, navigateSelf]);

    const runOwnDupCheck = (key, patient) => ownDupOf(patient).then((ownDup) => patch(key, { ownDup }));

    useEffect(() => {
        if (request.mode !== "edit" || !request.id) return undefined;
        const loadId = `${request.key}|${request.retry}`;
        const controller = new AbortController();
        const start = async () => {
            await null;
            const started = Date.now();
            if (saving.get(idKey(request.id))) {
                setLoad({ key: loadId, status: "waiting" });
                while (saving.get(idKey(request.id)) && Date.now() - started < WAIT_MS && !controller.signal.aborted) await sleep(WAIT_STEP_MS);
            }
            if (controller.signal.aborted) return;
            const result = await getPatient(request.id, { ...READ, signal: controller.signal });
            if (result.aborted || controller.signal.aborted) return;
            if (!result.success) {
                setLoad({ key: loadId, status: isPatientGone(result) ? "gone" : "error", result });
                return;
            }
            const carried = carry.take(idKey(request.id));
            setForm((f) => {
                if (f.key !== request.key) return f;
                const next = fromPatient(f, result.data, { keepTicked: true });
                return carried?.items ? { ...next, ticked: historyFromItems(carried.items) } : next;
            });
            setLoad({ key: loadId, status: "ready" });
            if (needsPhoneFix(result.data)) ownDupOf(result.data).then((ownDup) => setForm((f) => (f.key === request.key ? { ...f, ownDup } : f)));
        };
        start();
        return () => controller.abort();
    }, [request.mode, request.id, request.key, request.retry]);

    useLeaveGuard(sending || missingHistory(wantedHistory(current.ticked), current.stamp.profiles).length > 0);

    const checkDuplicate = (key, text) => {
        dupController.current?.abort();
        const subscriber = subscriberDigits(text);
        const original = formRef.current.original;
        const sameAsStored = original && subscriber && subscriber === subscriberDigits(original.phoneNumber) && isCompactPhone(original.phoneNumber);
        if (!text.trim() || !isValidPhone(text) || sameAsStored) {
            patch(key, { dup: null });
            return;
        }
        const controller = new AbortController();
        dupController.current = controller;
        const selfId = formRef.current.patientId;
        lookupByPhone(subscriber, { ...READ, signal: controller.signal }).then((result) => {
            if (result.aborted || controller.signal.aborted) return;
            if (subscriberDigits(formRef.current.values.phoneNumber) !== subscriber) return;
            if (!result.success) {
                patch(key, (f) => ({ dup: { status: "error", subscriber, match: f.dup?.subscriber === subscriber ? f.dup.match : null } }));
                return;
            }
            const match = (result.data?.items ?? []).find((p) => subscriberDigits(p.phoneNumber) === subscriber && Number(p.id) !== Number(selfId));
            patch(key, { dup: { status: "ready", subscriber, match: match ?? null } });
        });
    };

    const onFieldChange = (field, value) => {
        const key = loadKey;
        setForm((f) => {
            if (f.key !== key) return f;
            const values = { ...f.values, [field]: value };
            const edited = f.edited.includes(field) ? f.edited : [...f.edited, field];
            let next = { ...f, values, edited };
            if (field === "gender" && f.values.gender === "Female" && value !== "Female") {
                const { ticked, removed } = dropFemaleOnly(f.ticked);
                next = { ...next, ticked, notice: removed.length ? TEXT.HISTORY_FEMALE_REMOVED(removed.join(", ")) : f.notice };
            }
            if (field === "phoneNumber") {
                const stored = f.original?.phoneNumber;
                if (!value.trim() || (stored && subscriberDigits(value) === subscriberDigits(stored) && isCompactPhone(stored))) next = { ...next, dup: null };
            }
            return next;
        });
        if (field === "phoneNumber") {
            dupController.current?.abort();
            dupTimer.schedule(() => checkDuplicate(key, value));
        }
    };

    const onFieldBlur = (field) => {
        const key = loadKey;
        if (field === "phoneNumber") {
            dupTimer.cancel();
            checkDuplicate(key, formRef.current.values.phoneNumber);
        }
        setForm((f) => {
            if (f.key !== key || !f.seen.includes(field)) return f;
            const all = validateForm({ values: f.values, edited: new Set(f.edited), patient: f.original, mode: f.patientId ? "edit" : request.mode, today: clinicToday() });
            const errors = { ...f.errors };
            if (all[field]) errors[field] = all[field];
            else delete errors[field];
            return { ...f, errors };
        });
    };

    const onHistoryChange = (recordType, list) => patch(loadKey, (f) => ({ ticked: { ...f.ticked, [recordType]: list } }));

    const showServerError = (key, result, { createFlow = false } = {}) => {
        const field = fieldOfMessage(result);
        if (field && !(createFlow && field === "phoneNumber" && formRef.current.uncertainCreate)) {
            patch(key, (f) => ({ errors: { ...f.errors, [field]: errorText(result) }, seen: [...new Set([...f.seen, field])], forceBlood: f.forceBlood || field === "bloodType", alert: null }));
            setTimeout(() => focusField(field), 0);
            return;
        }
        const { fields, other } = fieldErrorsOf(result);
        const names = Object.keys(fields);
        if (names.length) {
            patch(key, (f) => ({ errors: { ...f.errors, ...fields }, seen: [...new Set([...f.seen, ...names])], alert: other ? { text: TEXT.ERR_FORM_INVALID } : null }));
            const first = ADMIN_FIELDS.find((n) => fields[n]);
            setTimeout(() => focusField(first), 0);
            return;
        }
        patch(key, { alert: { text: errorText(result) } });
    };

    const finishSave = ({ key, owner, id, code, created, listState }) => {
        saving.remove(idKey(id), (entry) => entry.run === key);
        carry.remove(idKey(id));
        if (created) drafts.remove(created);
        const text = created ? TEXT.CREATED(code) : TEXT.SAVED;
        if (isHere(key)) {
            notifyPatientRecord(owner, { text });
            navigate(getReceptionPatientRoute(id), { replace: true, state: listState });
            return;
        }
        notifyPatientRecord(owner, {
            text: created ? TEXT.AWAY_CREATED(code) : TEXT.SAVED_CODE(code),
            links: created ? [{ label: TEXT.OPEN_RECORD, url: getReceptionPatientRoute(id), state: listState }] : [],
        });
    };

    const saveHistory = async ({ key, owner, id, code, stamp: startStamp, ownIds, created, listState }) => {
        let stamp = startStamp;
        const ticked = formRef.current.key === key ? formRef.current.ticked : created?.ticked ?? emptyHistory();
        const wanted = wantedHistory(ticked);
        const todo = missingHistory(wanted, stamp.profiles);
        const editLink = { label: TEXT.OPEN_EDIT, url: getReceptionPatientEditRoute(id), state: listState };
        const report = async (failedResult) => {
            const fresh = await getPatient(id, READ);
            if (fresh.success) {
                stamp = stampOf(fresh.data);
                patch(key, { stamp, original: { ...formRef.current.original, ...fresh.data }, patientId: id });
            }
            const left = missingHistory(wanted, stamp.profiles);
            if (!left.length) return finishSave({ key, owner, id, code, created: created?.attemptId, listState });
            if (!isHere(key)) {
                carry.set(idKey(id), { items: left }, owner);
                const reason = failedResult ? errorText(failedResult) : TEXT.SAVE_UNKNOWN;
                notifyPatientRecord(owner, { text: TEXT.AWAY_HISTORY_FAILED(reason, left.map((x) => x.title).join(", ")), links: [editLink] }, { error: true });
                return undefined;
            }
            const text =
                created && !fresh.success
                    ? TEXT.HISTORY_AFTER_CREATE_ERROR(code, errorText(fresh))
                    : created
                      ? TEXT.HISTORY_PARTIAL(code, left.length, left[0].title)
                      : TEXT.HISTORY_PARTIAL_EDIT(left.length, left[0].title);
            patch(key, { alert: { text } });
            return undefined;
        };
        for (const item of todo) {
            if (!isOwnerSignedIn(owner)) return undefined;
            const result = await addMedicalProfile(id, item, READ);
            if (result.success && result.data) {
                stamp = addToStamp(stamp, result.data);
                ownIds.add(Number(result.data.id));
                patch(key, { stamp });
                continue;
            }
            return report(isUncertain(result) ? null : result);
        }
        return finishSave({ key, owner, id, code, created: created?.attemptId, listState });
    };

    const findCreated = async (values, day) => {
        const subscriber = subscriberDigits(values.phoneNumber);
        if (!subscriber) return { error: true };
        const result = await lookupByPhone(subscriber, READ);
        if (!result.success) return { error: true };
        const matches = (result.data?.items ?? [])
            .filter((p) => subscriberDigits(p.phoneNumber) === subscriber && clinicDateOf(p.createdAt) === day && nameKey(p.fullName) === nameKey(values.fullName))
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return { match: matches[0] ?? null };
    };

    const saveCreate = async ({ key, owner, day, listState }) => {
        const snapshot = formRef.current;
        const values = snapshot.values;
        const attemptId = snapshot.attemptId;
        const result = await createPatient(createBody(values), READ);
        const keepDraft = () => drafts.set(attemptId, { at: Date.now(), form: { values, ticked: snapshot.ticked } }, owner);
        const reopen = { label: TEXT.REOPEN_CREATE, url: RECEPTION_PATIENT_CREATE_ROUTE, state: { ...listState, attemptId } };
        if (result.success && result.data) {
            const created = result.data;
            const id = created.id;
            saving.set(idKey(id), { run: key }, owner);
            carry.set(idKey(id), { items: wantedHistory(snapshot.ticked) }, owner);
            const stamp = stampOf({ ...created, medicalProfiles: [] });
            if (isHere(key)) {
                setForm((f) => (f.key === key ? { ...fromPatient(f, { ...created, medicalProfiles: [] }), stamp, alert: null, draft: null } : f));
                navigateSelf(getReceptionPatientEditRoute(id), { replace: true });
            }
            return saveHistory({ key, owner, id, code: created.patientCode, stamp, ownIds: new Set(), created: { attemptId, ticked: snapshot.ticked }, listState });
        }
        const lookupAfter = isUncertain(result) || (hasMessage(result, BE_MESSAGES.PHONE_EXISTS) && snapshot.uncertainCreate);
        if (lookupAfter) {
            const found = await findCreated(values, day);
            if (found.match) {
                if (isHere(key)) {
                    patch(key, { uncertainCreate: true, alert: { text: TEXT.CREATE_MAYBE(found.match.fullName, found.match.patientCode), openExisting: found.match } });
                    return undefined;
                }
                carry.set(idKey(found.match.id), { items: wantedHistory(snapshot.ticked) }, owner);
                const link = { label: TEXT.OPEN_EDIT_CODE(found.match.patientCode), url: getReceptionPatientEditRoute(found.match.id), state: listState };
                notifyPatientRecord(owner, { text: TEXT.AWAY_CREATE_MAYBE(values.fullName.trim(), found.match.patientCode), links: [link] }, { error: true });
                return undefined;
            }
            const text = found.error ? TEXT.CREATE_UNKNOWN : TEXT.CREATE_NOT_SEEN;
            if (isHere(key)) {
                patch(key, { uncertainCreate: true, alert: { text } });
                return undefined;
            }
            keepDraft();
            notifyPatientRecord(owner, { text, links: [reopen] }, { error: true });
            return undefined;
        }
        if (isHere(key)) return showServerError(key, result, { createFlow: true });
        keepDraft();
        notifyPatientRecord(owner, { text: TEXT.AWAY_CREATE_FAILED(values.fullName.trim(), errorText(result)), links: [reopen] }, { error: true });
        return undefined;
    };

    const saveEdit = async ({ key, owner, listState, keepMine }) => {
        const snapshot = formRef.current;
        const id = snapshot.patientId;
        const code = snapshot.original?.patientCode ?? "";
        const ownIds = new Set();
        const lock = adminLockOf(snapshot.original, snapshot.ownDup);
        const historyOnly = lock || (!adminChanged(snapshot.values, snapshot.baseline) && !needsPhoneFix(snapshot.original));
        if (historyOnly && !keepMine) {
            const fresh = await getPatient(id, READ);
            if (!fresh.success) {
                if (isPatientGone(fresh)) return patch(key, { alert: { text: TEXT.RECORD_GONE, backToList: true } });
                return patch(key, { alert: { text: errorText(fresh) } });
            }
            patch(key, { stamp: stampOf(fresh.data) });
            return saveHistory({ key, owner, id, code, stamp: stampOf(fresh.data), ownIds, listState });
        }
        let latest = snapshot.original;
        if (!keepMine) {
            const fresh = await getPatient(id, READ);
            if (!isOwnerSignedIn(owner)) return undefined;
            if (!fresh.success) {
                if (isPatientGone(fresh)) return patch(key, { alert: { text: TEXT.RECORD_GONE, backToList: true } });
                return patch(key, { alert: { text: errorText(fresh) } });
            }
            if (!sameStamp(snapshot.stamp, fresh.data, ownIds)) {
                return patch(key, { conflict: { account: accountChanged(snapshot.stamp, fresh.data), fresh: fresh.data } });
            }
            latest = fresh.data;
        }
        if (!isOwnerSignedIn(owner)) return undefined;
        const edited = new Set(snapshot.edited);
        const body = updateBody({ values: snapshot.values, edited, original: snapshot.original, latest });
        const result = await updatePatient(id, body, READ);
        let saved = result.success ? result.data : null;
        if (!result.success && isUncertain(result)) {
            const check = await getPatient(id, READ);
            if (!check.success) return patch(key, { alert: { text: TEXT.SAVE_UNKNOWN } });
            if (!bodyMatches(body, check.data)) return patch(key, { conflict: { account: accountChanged(snapshot.stamp, check.data), fresh: check.data } });
            saved = check.data;
            latest = check.data;
        }
        if (!saved) {
            if (result.status === 409 && hasMessage(result, BE_MESSAGES.CONCURRENCY)) {
                const fresh = await getPatient(id, READ);
                if (fresh.success) return patch(key, { conflict: { account: accountChanged(snapshot.stamp, fresh.data), fresh: fresh.data } });
                return patch(key, { alert: { text: errorText(fresh) } });
            }
            if (isPatientGone(result)) return patch(key, { alert: { text: TEXT.RECORD_GONE, backToList: true } });
            if (!isHere(key)) {
                notifyPatientRecord(owner, { text: errorText(result), links: [{ label: TEXT.OPEN_EDIT, url: getReceptionPatientEditRoute(id), state: listState }] }, { error: true });
                return undefined;
            }
            return showServerError(key, result);
        }
        const profiles = latest.medicalProfiles ?? snapshot.stamp.profiles;
        const stamp = { ...stampOf({ ...saved, medicalProfiles: profiles }) };
        const original = { ...latest, ...saved, medicalProfiles: profiles };
        patch(key, (f) => ({ stamp, original, baseline: f.values, edited: [], conflict: null }));
        return saveHistory({ key, owner, id, code: saved.patientCode ?? code, stamp, ownIds, listState });
    };

    const submit = async ({ keepMine = false } = {}) => {
        if (sending) return;
        const key = loadKey;
        const snapshot = formRef.current;
        const editing = Boolean(snapshot.patientId);
        const lock = editing ? adminLockOf(snapshot.original, snapshot.ownDup) : null;
        const historyOnly = editing && (lock || (!adminChanged(snapshot.values, snapshot.baseline) && !needsPhoneFix(snapshot.original)));
        if (!historyOnly || keepMine) {
            const errors = validateForm({ values: snapshot.values, edited: new Set(snapshot.edited), patient: snapshot.original, mode: editing ? "edit" : "create", today: clinicToday() });
            const first = ADMIN_FIELDS.find((f) => errors[f]);
            if (first) {
                patch(key, { errors, seen: [...new Set([...snapshot.seen, ...Object.keys(errors)])] });
                setTimeout(() => focusField(first), 0);
                return;
            }
        }
        const owner = getSessionToken();
        const day = clinicToday();
        const listState = nav.linkState();
        patch(key, { errors: {}, alert: null, conflict: null });
        setRun({ key });
        if (editing) saving.set(idKey(snapshot.patientId), { run: key }, owner);
        try {
            if (editing) await saveEdit({ key, owner, listState, keepMine });
            else await saveCreate({ key, owner, day, listState });
        } finally {
            if (editing) saving.remove(idKey(snapshot.patientId), (entry) => entry.run === key);
            if (isHere(key)) setRun((r) => (r?.key === key ? null : r));
        }
    };

    const openExisting = async (match) => {
        const key = loadKey;
        const result = await getPatient(match.id, READ);
        if (!result.success) return patch(key, { alert: { text: errorText(result) } });
        patch(key, (f) => ({ ...fromPatient(f, result.data, { keepTicked: true }), alert: { text: TEXT.OPENED_EXISTING(result.data.patientCode), warning: true }, uncertainCreate: false }));
        if (needsPhoneFix(result.data)) runOwnDupCheck(key, result.data);
        navigateSelf(getReceptionPatientEditRoute(result.data.id), { replace: true });
        return undefined;
    };

    const resolveConflict = (keepMine) => {
        const fresh = current.conflict?.fresh;
        if (!fresh) return;
        if (!keepMine) {
            patch(loadKey, (f) => ({ ...fromPatient(f, fresh, { keepTicked: true }), alert: null }));
            if (needsPhoneFix(fresh)) runOwnDupCheck(loadKey, fresh);
            return;
        }
        const reloaded = formFromPatient(fresh);
        setForm((f) => {
            if (f.key !== loadKey) return f;
            const values = { ...f.values };
            ADMIN_FIELDS.forEach((field) => {
                if (!f.edited.includes(field)) values[field] = reloaded[field];
            });
            const next = { ...f, values, original: fresh, stamp: stampOf(fresh), conflict: null };
            formRef.current = next;
            return next;
        });
        setTimeout(() => submit({ keepMine: true }), 0);
    };

    const applyDraft = () => {
        const prompt = current.draft;
        if (!prompt) return;
        drafts.remove(prompt.id);
        patch(loadKey, { values: prompt.entry.form.values, ticked: prompt.entry.form.ticked, edited: [...ADMIN_FIELDS], attemptId: prompt.id, draft: null });
    };

    const dropDraft = () => {
        const prompt = current.draft;
        if (!prompt) return;
        drafts.remove(prompt.id);
        patch(loadKey, { draft: null });
    };

    const listHref = `${ROUTES.RECEPTION_PATIENTS}${safeListSearch(location.state?.listSearch)}`;
    const detailHref = patientId ? getReceptionPatientRoute(patientId) : listHref;
    const cancelHref = mode === "edit" ? detailHref : listHref;
    const crumbs =
        mode === "edit"
            ? [{ label: TEXT.TITLE, href: listHref }, { label: current.original?.fullName ?? TEXT.LOADING, href: detailHref }, { label: TEXT.EDIT_CRUMB }]
            : [{ label: TEXT.TITLE, href: listHref }, { label: TEXT.CREATE_TITLE }];

    const ready = request.mode === "create" || current.patientId != null || loadCurrent?.status === "ready";
    const header = (
        <>
            <Breadcrumb items={crumbs} className="mb-2" />
            <h1 ref={h1Ref} tabIndex={-1} className="page-title outline-none">
                {mode === "edit" ? TEXT.EDIT_TITLE : TEXT.CREATE_TITLE}
            </h1>
            {ready && <p className="page-description mb-5">{TEXT.FORM_HINT}</p>}
        </>
    );

    if (request.mode === "edit" && (!idInfo || loadCurrent?.status === "gone") && !current.patientId) {
        return (
            <div className="app-content min-h-full">
                <Breadcrumb items={[{ label: TEXT.TITLE, href: listHref }, { label: TEXT.NOT_FOUND }]} className="mb-2" />
                <section className="rounded-xl border border-border bg-canvas p-8 text-center">
                    <h1 ref={h1Ref} tabIndex={-1} className="page-title outline-none">
                        {TEXT.NOT_FOUND}
                    </h1>
                    <p className="mt-2 text-body-sm text-muted">{TEXT.NOT_FOUND_TEXT}</p>
                    <Link to={listHref} className="btn btn-primary mt-4">
                        {TEXT.BACK_TO_LIST}
                    </Link>
                </section>
            </div>
        );
    }

    if (!ready) {
        return (
            <div className="app-content min-h-full">
                {header}
                {loadCurrent?.status === "error" ? (
                    <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                        <span className="flex-1">
                            {TEXT.LOAD_ERROR} {errorText(loadCurrent.result)}
                        </span>
                        <button type="button" className="btn btn-secondary h-9" onClick={() => setReq((r) => ({ ...r, retry: r.retry + 1 }))}>
                            {TEXT.RETRY}
                        </button>
                    </div>
                ) : (
                    <p role="status" className="text-body-sm text-muted">
                        {loadCurrent?.status === "waiting" ? TEXT.WAITING_PREVIOUS_SAVE : TEXT.LOADING}
                    </p>
                )}
            </div>
        );
    }

    const lock = mode === "edit" ? adminLockOf(current.original, current.ownDup) : null;
    const groups = historyGroups(current.values.gender, current.stamp.profiles);
    const conflict = current.conflict;

    return (
        <div className="app-content min-h-full">
            {header}
            <form
                noValidate
                className="space-y-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                {current.draft && (
                    <div role="status" className="alert alert-info flex flex-wrap items-center gap-3">
                        <span className="flex-1">
                            {TEXT.DRAFT_FOUND(current.draft.entry.form.values.fullName.trim() || TEXT.DASH)}
                            {current.draft.others > 0 && TEXT.DRAFT_MORE(current.draft.others)}
                        </span>
                        <button type="button" className="btn btn-secondary h-9" onClick={applyDraft}>
                            {TEXT.DRAFT_USE}
                        </button>
                        <button type="button" className="btn btn-link h-9" onClick={dropDraft}>
                            {TEXT.DRAFT_DROP}
                        </button>
                    </div>
                )}
                {current.alert && (
                    <div ref={alertRef} role="alert" tabIndex={-1} className={current.alert.warning ? "alert alert-warning flex flex-wrap items-center gap-3" : "alert alert-danger flex flex-wrap items-center gap-3"}>
                        <span className="flex-1">{current.alert.text}</span>
                        {current.alert.openExisting && (
                            <button type="button" className="btn btn-secondary h-9" onClick={() => openExisting(current.alert.openExisting)}>
                                {TEXT.DUP_OPEN}
                            </button>
                        )}
                        {current.alert.backToList && (
                            <Link to={listHref} className="btn btn-secondary h-9">
                                {TEXT.BACK_TO_LIST}
                            </Link>
                        )}
                    </div>
                )}
                <Card title={TEXT.ADMIN_CARD}>
                    <div className="p-5">
                    <PatientAdminFields
                        values={current.values}
                        errors={current.errors}
                        onChange={onFieldChange}
                        onBlur={onFieldBlur}
                        mode={mode}
                        patient={current.original}
                        today={today}
                        lock={lock}
                        dup={current.dup}
                        onRetryDup={() => checkDuplicate(loadKey, current.values.phoneNumber)}
                        linkState={nav.linkState()}
                        forceBloodType={current.forceBlood}
                    />
                    </div>
                </Card>
                <Card title={TEXT.HISTORY_CARD} actions={<span className="text-caption text-muted">{TEXT.HISTORY_TOGGLE_HINT}</span>}>
                    <div className="p-5">
                    <PatientHistoryFields
                        groups={groups}
                        ticked={current.ticked}
                        onChange={onHistoryChange}
                        notice={current.notice}
                        lockedNote={mode === "edit" ? TEXT.HISTORY_LOCKED_NOTE : null}
                    />
                    </div>
                </Card>
                {conflict && (
                    <div role="alert" className="alert alert-warning flex flex-wrap items-center gap-3">
                        <span className="flex-1">{conflict.account ? TEXT.CONFLICT_ACCOUNT : TEXT.CONFLICT}</span>
                        <button type="button" className="btn btn-secondary h-9" onClick={() => resolveConflict(false)}>
                            {TEXT.CONFLICT_RELOAD}
                        </button>
                        {!conflict.account && (
                            <button type="button" className="btn btn-primary h-9" onClick={() => resolveConflict(true)}>
                                {TEXT.CONFLICT_KEEP}
                            </button>
                        )}
                    </div>
                )}
                <div className="sticky bottom-0 z-10 -mx-6 flex justify-end gap-2 border-t border-border bg-canvas px-6 py-3">
                    <Link
                        to={cancelHref}
                        state={nav.linkState()}
                        className="btn btn-secondary"
                        aria-disabled={sending ? "true" : undefined}
                        onClick={(event) => {
                            if (sending) event.preventDefault();
                        }}
                    >
                        {TEXT.CANCEL}
                    </Link>
                    <button type="submit" className="btn btn-primary" aria-disabled={sending ? "true" : undefined}>
                        {sending && <span className="btn-spinner" aria-hidden />}
                        {mode === "edit" ? TEXT.SAVE_EDIT : TEXT.SAVE_CREATE}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ReceptionPatientForm;
