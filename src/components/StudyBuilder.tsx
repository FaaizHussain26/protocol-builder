import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers, ClipboardCheck, AlertTriangle, FileOutput, RotateCcw,
  Check, X, Pencil, FlaskConical, ListChecks, Plus,
  PenLine, Upload, FileText, CircleDot, Save, Trash2, RefreshCw, Copy, CopyPlus,
  ChevronDown, GripVertical, Split, SlidersHorizontal, FolderTree, Folder,
} from 'lucide-react';
import type {
  StudyModel, StudyField, StudyForm, StudyVisit, ReviewStatus,
} from '../types/study';
import { regenerateForm, saveStudy } from '../utils/api';
import { ALL_STANDARD_NAMES, canonicalRank } from '../utils/standardForms';
import { arrayMove } from '@dnd-kit/sortable';
import { SortableList, SortableRow } from './dnd';
import { ConfidenceBadge, TypeBadge, Pill } from './ui';
import EligibilityPanel from './EligibilityPanel';
import FindingsPanel from './FindingsPanel';
import ExportPanel from './ExportPanel';
import FieldEditorDrawer from './FieldEditorDrawer';

// Identifies which field (or new field) the editor drawer is targeting.
interface EditTarget {
  formId: string;
  field: StudyField;
  isNew: boolean;
}

let newFieldCounter = 0;
function blankField(): StudyField {
  newFieldCounter += 1;
  return {
    id: `new-fld-${Date.now()}-${newFieldCounter}`,
    label: '',
    type: 'text',
    required: false,
    confidence: 'high',
    completionGuidance: '',
    source: 'Manually added',
    reviewStatus: 'accepted',
  };
}

let newFormCounter = 0;
function blankForm(): StudyForm {
  newFormCounter += 1;
  return { id: `new-form-${Date.now()}-${newFormCounter}`, name: 'New Form', appliedTemplate: null, fields: [], rules: [] };
}

let newVisitCounter = 0;
function blankVisit(): StudyVisit {
  newVisitCounter += 1;
  return { id: `new-visit-${Date.now()}-${newVisitCounter}`, name: 'New Visit', kind: 'visit', forms: [] };
}

// Deep-copy a form with FRESH ids for the form and every field/rule/alert. This
// is essential: reusing the source ids would make the form mutators (which match
// by id) act on both copies — the bug where saving/editing "deletes" the original.
let cloneCounter = 0;
function cloneForm(src: StudyForm, nameSuffix = ' (copy)'): StudyForm {
  cloneCounter += 1;
  const stamp = `${Date.now()}-${cloneCounter}`;
  return {
    ...src,
    id: `form-copy-${stamp}`,
    name: `${src.name}${nameSuffix}`,
    fields: src.fields.map((f, i) => {
      // Drop learning metadata — a copy is not itself a user edit of the original.
      const { editedByUser, aiOriginal, ...rest } = f;
      void editedByUser; void aiOriginal;
      return { ...rest, id: `fld-copy-${stamp}-${i}`, reviewStatus: 'pending' as ReviewStatus };
    }),
    rules: src.rules.map((r, i) => ({ ...r, id: `rule-copy-${stamp}-${i}`, accepted: null })),
    alerts: src.alerts?.map((a, i) => ({ ...a, id: `alert-copy-${stamp}-${i}` })),
  };
}

const visitCtlBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0,
};

const reorderBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 20, height: 16, borderRadius: 5, border: '1px solid #e2e8f0',
  background: '#fff', color: disabled ? '#cbd5e1' : '#64748b',
  cursor: disabled ? 'default' : 'pointer', padding: 0, flexShrink: 0,
});

interface StudyBuilderProps {
  study: StudyModel;
  setStudy: (s: StudyModel) => void;
  onReset: () => void;
  /** Persisted study id (set once saved). */
  studyId?: string;
  /** Extracted source corpus, used to regenerate individual forms. */
  protocolText?: string;
  /** Called with the new id after a first save. */
  onStudyIdChange?: (id: string) => void;
  /** Debounced auto-save (as a draft) when the study changes. */
  autoSaveEnabled?: boolean;
  /** Controlled section — when provided (by the app sidebar), the internal tab bar is hidden. */
  tab?: Tab;
  onTabChange?: (t: Tab) => void;
}

export type Tab = 'build' | 'folders' | 'eligibility' | 'intelligence' | 'export' | 'settings';

export default function StudyBuilder({ study, setStudy, onReset, studyId, protocolText, onStudyIdChange, autoSaveEnabled, tab: controlledTab, onTabChange }: StudyBuilderProps) {
  const [internalTab, setInternalTab] = useState<Tab>('build');
  const tab = controlledTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;
  const [activeVisitId, setActiveVisitId] = useState(study.visits[0]?.id ?? '');
  const [activeFormId, setActiveFormId] = useState(study.visits[0]?.forms[0]?.id ?? '');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'final' | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  // Review filter: narrows the forms list and the visible fields by status.
  const [reviewFilter, setReviewFilter] = useState<'all' | ReviewStatus>('all');

  // Reset the form panel's scroll to the top whenever the form/visit/tab changes,
  // so a freshly-selected form starts at its first question.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeFormId, activeVisitId, tab]);

  // ---- Auto-save plumbing ----
  // studyRef always holds the latest study (so a queued save uses fresh data);
  // savedIdRef is the id of the persisted study, shared by manual + auto save so
  // neither ever creates a duplicate before the studyId prop round-trips.
  const studyRef = useRef(study);
  studyRef.current = study;
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const firstAutoRun = useRef(true);
  const savedIdRef = useRef<string | undefined>(studyId);
  useEffect(() => { savedIdRef.current = studyId; }, [studyId]);

  // ---- Derived counts ----
  const stats = useMemo(() => {
    let total = 0, accepted = 0, rejected = 0, flagged = 0;
    for (const v of study.visits)
      for (const f of v.forms)
        for (const fld of f.fields) {
          total++;
          if (fld.reviewStatus === 'accepted') accepted++;
          else if (fld.reviewStatus === 'rejected') rejected++;
          if (fld.confidence === 'low' && fld.reviewStatus === 'pending') flagged++;
        }
    const openBlockers = study.findings.filter(f => f.severity === 'blocker' && !f.resolved).length;
    return { total, accepted, rejected, flagged, pending: total - accepted - rejected, openBlockers };
  }, [study]);

  // ---- Field mutations ----
  const mutateField = (formId: string, fieldId: string, patch: Partial<StudyField>) => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => f.id !== formId ? f : {
          ...f,
          fields: f.fields.map(fld => fld.id !== fieldId ? fld : { ...fld, ...patch }),
        }),
      })),
    });
  };

  const setRuleAccepted = (formId: string, ruleId: string, accepted: boolean) => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => f.id !== formId ? f : {
          ...f,
          rules: f.rules.map(r => r.id !== ruleId ? r : { ...r, accepted }),
        }),
      })),
    });
  };

  // Bulk review: set every field (and edit check) in one form to a status.
  const setFormReview = (formId: string, status: ReviewStatus) => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => f.id !== formId ? f : {
          ...f,
          fields: f.fields.map(fld => ({ ...fld, reviewStatus: status })),
          rules: f.rules.map(r => ({ ...r, accepted: status === 'accepted' })),
        }),
      })),
    });
  };

  // Bulk review: approve every field and edit check across the whole eSource.
  const approveAll = () => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => ({
          ...f,
          fields: f.fields.map(fld => ({ ...fld, reviewStatus: 'accepted' as ReviewStatus })),
          rules: f.rules.map(r => ({ ...r, accepted: true })),
        })),
      })),
    });
  };

  // Map over the fields of one form.
  const mapFormFields = (formId: string, fn: (fields: StudyField[]) => StudyField[]) => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => f.id !== formId ? f : { ...f, fields: fn(f.fields) }),
      })),
    });
  };

  // Insert or replace a field (called on drawer save). When the user changes an
  // AI-generated field, keep a one-time snapshot of the original so the backend
  // can learn the correction and generate it right next time.
  const saveField = (formId: string, field: StudyField, isNew: boolean) => {
    if (isNew) mapFormFields(formId, fields => [...fields, field]);
    else mapFormFields(formId, fields => fields.map(f => {
      if (f.id !== field.id) return f;
      const changed =
        f.label !== field.label || f.type !== field.type || f.required !== field.required ||
        (f.options ?? []).join('|') !== (field.options ?? []).join('|') ||
        (f.completionGuidance ?? '') !== (field.completionGuidance ?? '') ||
        (f.section ?? '') !== (field.section ?? '');
      if (!changed) return field;
      return {
        ...field,
        editedByUser: true,
        aiOriginal: f.aiOriginal ?? {
          label: f.label, type: f.type, required: f.required,
          options: f.options, completionGuidance: f.completionGuidance, section: f.section,
        },
      };
    }));
    setEditTarget(null);
  };

  const deleteField = (formId: string, fieldId: string) => {
    mapFormFields(formId, fields => fields.filter(f => f.id !== fieldId));
    setEditTarget(null);
  };

  // Copy a single input, inserted right after the original (fresh id, pending).
  const duplicateField = (formId: string, fieldId: string) =>
    mapFormFields(formId, fields => {
      const i = fields.findIndex(f => f.id === fieldId);
      if (i < 0) return fields;
      const { editedByUser, aiOriginal, ...rest } = fields[i];
      void editedByUser; void aiOriginal;
      newFieldCounter += 1;
      const copy: StudyField = { ...rest, id: `fld-copy-${Date.now()}-${newFieldCounter}`, label: `${rest.label} (copy)`, reviewStatus: 'pending' };
      const next = [...fields];
      next.splice(i + 1, 0, copy);
      return next;
    });

  const openEdit = (formId: string, field: StudyField) => setEditTarget({ formId, field, isNew: false });
  const openAdd = (formId: string) => setEditTarget({ formId, field: blankField(), isNew: true });

  // ---- Visit & form structure mutations ----
  const addVisit = () => {
    const v = blankVisit();
    setStudy({ ...study, visits: [...study.visits, v] });
    setActiveVisitId(v.id);
    setActiveFormId('');
  };
  const removeVisit = (visitId: string) => {
    const visits = study.visits.filter(v => v.id !== visitId);
    setStudy({ ...study, visits });
    if (activeVisitId === visitId) { setActiveVisitId(visits[0]?.id ?? ''); setActiveFormId(''); }
  };
  const renameVisit = (visitId: string, name: string) =>
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, name }) });
  // Reorder visits by drag-and-drop within an arm (see VisitPicker) — move the
  // dragged visit to the drop target's position in the global visits array.
  const reorderVisitsById = (fromId: string, toId: string) => {
    const from = study.visits.findIndex(v => v.id === fromId);
    const to = study.visits.findIndex(v => v.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    setStudy({ ...study, visits: arrayMove(study.visits, from, to) });
  };

  // ---- Arms (main folders) & the Folders tab ----
  const addArm = () => {
    const existing = new Set(study.visits.map(v => v.arm ?? 'Study Visit'));
    let n = 1; while (existing.has(`New Arm ${n}`)) n += 1;
    setStudy({ ...study, visits: [...study.visits, { ...blankVisit(), name: 'New Folder', arm: `New Arm ${n}` }] });
  };
  const addFolderToArm = (arm: string) =>
    setStudy({ ...study, visits: [...study.visits, { ...blankVisit(), name: 'New Folder', arm }] });
  const renameArm = (oldName: string, newName: string) => {
    const name = newName.trim(); if (!name || name === oldName) return;
    setStudy({ ...study, visits: study.visits.map(v => (v.arm ?? 'Study Visit') === oldName ? { ...v, arm: name } : v) });
  };
  // Replace the whole visits array — used by the Folders tab drag tree, which
  // recomputes both order and each folder's arm from the dropped position.
  const setVisits = (next: StudyVisit[]) => setStudy({ ...study, visits: next });

  const addForm = (visitId: string, name?: string) => {
    const f = { ...blankForm(), name: name || 'New Form' };
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, forms: [...v.forms, f] }) });
    setActiveFormId(f.id);
  };
  const sortFormsStandard = (visitId: string) =>
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, forms: [...v.forms].sort((a, b) => canonicalRank(a.name) - canonicalRank(b.name)) }) });
  const removeForm = (visitId: string, formId: string) =>
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, forms: v.forms.filter(f => f.id !== formId) }) });
  const updateForm = (formId: string, patch: Partial<StudyForm>) =>
    setStudy({ ...study, visits: study.visits.map(v => ({ ...v, forms: v.forms.map(f => f.id !== formId ? f : { ...f, ...patch }) })) });

  // ---- Manual form ordering (drag-and-drop via @dnd-kit) ----
  const reorderFormsByIndex = (visitId: string, from: number, to: number) =>
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, forms: arrayMove(v.forms, from, to) }) });

  // ---- Field & section ordering (drag-and-drop via @dnd-kit) ----
  // Replace a form's fields with a reordered array. FormBlock builds this from a
  // single flat drag list of section-headers + fields, updating each field's
  // section so dragging across a header moves the input into that section.
  const reorderFormFields = (formId: string, next: StudyField[]) =>
    mapFormFields(formId, () => next);

  // Duplicate an entire section's questions within the same form. Build a
  // repeated section (e.g. three sets of vitals) once, then copy it — the block
  // is inserted right after the source and gets the next free numbered name
  // ("Vital Signs" → "Vital Signs 2"). Fresh field ids keep the copy independent.
  const duplicateSection = (formId: string, section: string | null) =>
    mapFormFields(formId, fields => {
      const groups = groupFieldsBySection(fields);
      const gi = groups.findIndex(g => g.section === section);
      if (gi < 0 || !groups[gi].section) return fields;
      const base = groups[gi].section!.replace(/\s+\d+$/, '').trim() || 'Section';
      const taken = new Set(groups.map(g => g.section));
      let n = 2, name = `${base} ${n}`;
      while (taken.has(name)) { n += 1; name = `${base} ${n}`; }
      newFieldCounter += 1;
      const stamp = `${Date.now()}-${newFieldCounter}`;
      const copies = groups[gi].fields.map((f, i) => {
        const { editedByUser, aiOriginal, ...rest } = f;
        void editedByUser; void aiOriginal;
        return { ...rest, id: `fld-sec-${stamp}-${i}`, section: name, reviewStatus: 'pending' as ReviewStatus };
      });
      return groups.flatMap((g, idx) => idx === gi ? [...g.fields, ...copies] : g.fields);
    });

  // Add a repeated section: turn the form's current fields into "Section 1" (if
  // not already sectioned) and append an identical copy as the next section.
  const addSection = (formId: string) =>
    mapFormFields(formId, fields => {
      if (!fields.length) return fields;
      let working = fields;
      const g0 = groupFieldsBySection(working);
      if (g0.length === 1 && g0[0].section == null) working = working.map(f => ({ ...f, section: 'Section 1' }));
      const groups = groupFieldsBySection(working);
      const first = groups[0];
      const base = (first.section || 'Section').replace(/\s+\d+$/, '').trim() || 'Section';
      const taken = new Set(groups.map(g => g.section));
      let n = 2; while (taken.has(`${base} ${n}`)) n += 1;
      newFieldCounter += 1;
      const stamp = `${Date.now()}-${newFieldCounter}`;
      const copies = first.fields.map((f, i) => {
        const { editedByUser, aiOriginal, ...rest } = f;
        void editedByUser; void aiOriginal;
        return { ...rest, id: `fld-sec-${stamp}-${i}`, section: `${base} ${n}`, reviewStatus: 'pending' as ReviewStatus };
      });
      return [...working, ...copies];
    });

  // Copy the ENTIRE form's content into itself: clone every field (all
  // sections) with fresh ids and append it as a second block. Copied sections
  // are suffixed "(copy)" so the duplicate stays distinct from the original.
  const duplicateFormContent = (formId: string) =>
    mapFormFields(formId, fields => {
      if (!fields.length) return fields;
      newFieldCounter += 1;
      const stamp = `${Date.now()}-${newFieldCounter}`;
      const existing = new Set(fields.map(f => f.section?.trim() || null).filter(Boolean) as string[]);
      const copyName = new Map<string | null, string>();
      for (const f of fields) {
        const key = f.section?.trim() || null;
        if (copyName.has(key)) continue;
        const stem = key ? `${key} (copy)` : 'Copy';
        let name = stem, n = 2;
        while (existing.has(name)) { name = key ? `${key} (copy ${n})` : `Copy ${n}`; n += 1; }
        existing.add(name);
        copyName.set(key, name);
      }
      const copies = fields.map((f, i) => {
        const { editedByUser, aiOriginal, ...rest } = f;
        void editedByUser; void aiOriginal;
        return { ...rest, id: `fld-fcopy-${stamp}-${i}`, section: copyName.get(f.section?.trim() || null)!, reviewStatus: 'pending' as ReviewStatus };
      });
      return [...fields, ...copies];
    });

  // Copy a section (e.g. a required Signature block) into EVERY form in the
  // study. Build it once, then stamp it onto every page. Idempotent: the source
  // form and any form that already has a section of that name are skipped.
  const applySectionToAllForms = (sourceFormId: string, section: string | null) => {
    if (!section) return;
    let source: StudyField[] | null = null;
    for (const v of study.visits) {
      const f = v.forms.find(x => x.id === sourceFormId);
      if (f) { source = f.fields.filter(x => (x.section?.trim() || null) === section); break; }
    }
    if (!source || source.length === 0) return;
    const stampBase = Date.now();
    let added = 0;
    const visits = study.visits.map(v => ({
      ...v,
      forms: v.forms.map(f => {
        if (f.id === sourceFormId) return f;
        if (f.fields.some(x => (x.section?.trim() || null) === section)) return f;
        added += 1;
        const copies = source!.map((fld, i) => {
          const { editedByUser, aiOriginal, ...rest } = fld;
          void editedByUser; void aiOriginal;
          return { ...rest, id: `fld-all-${stampBase}-${added}-${i}`, section, reviewStatus: 'pending' as ReviewStatus };
        });
        return { ...f, fields: [...f.fields, ...copies] };
      }),
    }));
    setStudy({ ...study, visits });
    setSaveMsg(added > 0
      ? `“${section}” added to ${added} form${added !== 1 ? 's' : ''}`
      : `“${section}” is already on every form`);
  };

  // Duplicate a form within the same visit (inserted right after the source).
  const duplicateForm = (visitId: string, formId: string) => {
    const src = study.visits.find(v => v.id === visitId)?.forms.find(f => f.id === formId);
    if (!src) return;
    const copy = cloneForm(src);
    setStudy({
      ...study,
      visits: study.visits.map(v => {
        if (v.id !== visitId) return v;
        const i = v.forms.findIndex(f => f.id === formId);
        return { ...v, forms: [...v.forms.slice(0, i + 1), copy, ...v.forms.slice(i + 1)] };
      }),
    });
    setActiveFormId(copy.id);
  };

  // Copy a form from any other visit into the target visit (keeps its name).
  const copyFormFrom = (sourceVisitId: string, sourceFormId: string, targetVisitId: string) => {
    const src = study.visits.find(v => v.id === sourceVisitId)?.forms.find(f => f.id === sourceFormId);
    if (!src) return;
    const copy = cloneForm(src, '');
    setStudy({
      ...study,
      visits: study.visits.map(v => v.id !== targetVisitId ? v : { ...v, forms: [...v.forms, copy] }),
    });
    setActiveVisitId(targetVisitId);
    setActiveFormId(copy.id);
  };

  // Re-run enrichment for one form using its per-form prompt.
  const handleRegenerate = async (form: StudyForm) => {
    setRegenId(form.id);
    setSaveMsg(null);
    try {
      const { fields, rules } = await regenerateForm({
        formName: form.name,
        formDescription: form.description,
        studyTitle: study.studyTitle,
        indication: study.indication,
        protocolText,
        prompt: form.prompt,
      });
      updateForm(form.id, { fields, rules });
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenId(null);
    }
  };

  // Ready for "My Saved E-Sources" once every field has been REVIEWED (accepted
  // or rejected — rejected fields are simply excluded from the eSource) and at
  // least one field is kept. Pending fields still block the final save.
  const fullyApproved = stats.total > 0 && stats.pending === 0 && stats.accepted > 0;

  // Persist the study as a draft (partially reviewed) or final (fully reviewed).
  const handleSave = async (status: 'draft' | 'final') => {
    if (status === 'final' && !fullyApproved) return;
    setSaving(status);
    setSaveMsg(null);
    try {
      const saved = await saveStudy({ ...study, status }, savedIdRef.current ?? studyId);
      if (saved.id) { savedIdRef.current = saved.id; if (saved.id !== studyId) onStudyIdChange?.(saved.id); }
      setStudy(saved);
      setSaveMsg(status === 'final' ? 'Saved to E-Sources' : 'Draft saved');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  // Debounced auto-save — always writes a DRAFT (no approval gate). Coalesces
  // rapid edits and never overwrites the in-memory study with the server copy,
  // so the user's in-flight edits are never lost.
  const runAutoSave = useCallback(async () => {
    if (savingRef.current) { pendingRef.current = true; return; }
    savingRef.current = true;
    setAutoMsg('Saving…');
    try {
      const s = studyRef.current;
      const saved = await saveStudy({ ...s, status: s.status === 'final' ? 'final' : 'draft' }, savedIdRef.current);
      if (saved.id) { savedIdRef.current = saved.id; onStudyIdChange?.(saved.id); }
      setAutoMsg('Auto-saved');
    } catch {
      setAutoMsg('Auto-save failed');
    } finally {
      savingRef.current = false;
      if (pendingRef.current) { pendingRef.current = false; void runAutoSave(); }
    }
  }, [onStudyIdChange]);

  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (firstAutoRun.current) { firstAutoRun.current = false; return; } // skip the initial load
    const t = window.setTimeout(() => { void runAutoSave(); }, 1500);
    return () => window.clearTimeout(t);
  }, [study, autoSaveEnabled, runAutoSave]);

  const activeVisit = study.visits.find(v => v.id === activeVisitId) ?? study.visits[0];
  // Active form within the selected visit; falls back to the first form so a
  // visit change automatically lands on that visit's first form.
  const activeForm = activeVisit?.forms.find(f => f.id === activeFormId) ?? activeVisit?.forms[0];

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'build', label: 'Study Build', icon: <Layers size={15} /> },
    { id: 'folders', label: 'Folders', icon: <FolderTree size={15} /> },
    { id: 'eligibility', label: 'Eligibility', icon: <ListChecks size={15} />, badge: study.eligibility.length },
    { id: 'intelligence', label: 'Intelligence', icon: <AlertTriangle size={15} />, badge: study.findings.filter(f => !f.resolved).length },
    { id: 'settings', label: 'eSource Settings', icon: <SlidersHorizontal size={15} /> },
    { id: 'export', label: 'Export', icon: <FileOutput size={15} /> },
  ];

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      {/* Study header */}
      <div style={{
        background:
          'radial-gradient(640px 300px at 93% -35%, rgba(242,106,27,0.32) 0%, rgba(242,106,27,0) 62%),' +
          'linear-gradient(135deg, #0b1220 0%, #15233c 55%, #25364f 100%)',
        borderRadius: '22px 22px 0 0', padding: '28px 32px', color: '#fff',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <FlaskConical size={16} color="#f26a1b" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f26a1b', letterSpacing: 1, textTransform: 'uppercase' }}>
                Structured eSource Build
              </span>
            </div>
            <h1 style={{ fontSize: 23, fontWeight: 700, marginBottom: 8, letterSpacing: -0.4 }}>{study.studyTitle}</h1>
            <p style={{ fontSize: 13.5, opacity: 0.8, lineHeight: 1.5, maxWidth: 680 }}>{study.studyDescription}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {study.protocolNumber && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">Protocol {study.protocolNumber}</Pill>}
              {study.phase && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.phase}</Pill>}
              {study.indication && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.indication}</Pill>}
              {study.sponsor && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.sponsor}</Pill>}
              <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.documents.length} source doc{study.documents.length !== 1 ? 's' : ''}</Pill>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {(() => {
              const msg = saveMsg ?? autoMsg;
              if (!msg) return null;
              const color = /fail/i.test(msg) ? '#fca5a5' : msg === 'Saving…' ? '#cbd5e1' : '#4ade80';
              return <span style={{ fontSize: 12, fontWeight: 600, color }}>{msg}</span>;
            })()}
            <button onClick={approveAll} disabled={stats.pending === 0 && stats.rejected === 0} className="lift" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 9, border: '1px solid rgba(74,222,128,0.45)',
              background: 'rgba(34,197,94,0.18)', color: '#4ade80',
              cursor: stats.pending === 0 && stats.rejected === 0 ? 'default' : 'pointer',
              opacity: stats.pending === 0 && stats.rejected === 0 ? 0.5 : 1,
              fontSize: 12.5, fontWeight: 600,
            }}>
              <Check size={13} /> Approve all
            </button>
            <button onClick={() => handleSave('draft')} disabled={saving !== null} className="lift" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 9, border: '1px solid rgba(251,191,36,0.5)',
              background: 'rgba(245,158,11,0.22)', color: '#fbbf24',
              cursor: saving ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 600,
            }}>
              <Pencil size={13} /> {saving === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
            <button
              onClick={() => handleSave('final')}
              disabled={saving !== null || !fullyApproved}
              className="lift"
              title={fullyApproved ? 'Save the reviewed eSource' : stats.accepted === 0 ? 'Accept at least one field first' : `Review every field first (${stats.pending} pending)`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 9, border: '1px solid rgba(242,106,27,0.5)',
                background: fullyApproved ? 'rgba(242,106,27,0.9)' : 'rgba(148,163,184,0.25)',
                color: fullyApproved ? '#fff' : 'rgba(226,232,240,0.55)',
                cursor: saving ? 'wait' : fullyApproved ? 'pointer' : 'not-allowed',
                fontSize: 12.5, fontWeight: 600,
              }}
            >
              <Save size={13} /> {saving === 'final' ? 'Saving…' : 'Save to E-Sources'}
            </button>
            <button onClick={onReset} className="lift" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
              cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
            }}>
              <RotateCcw size={13} /> New Build
            </button>
          </div>
        </div>

        {/* Review counter strip */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <CounterChip label="Fields" value={stats.total} color="#e2e8f0" />
          <CounterChip label="Approved" value={stats.accepted} color="#4ade80" />
          <CounterChip label="Flagged for review" value={stats.flagged} color="#fbbf24" />
          <CounterChip label="Pending" value={stats.pending} color="#cbd5e1" />
          {stats.openBlockers > 0 && <CounterChip label="Open blockers" value={stats.openBlockers} color="#f87171" />}
        </div>
      </div>

      {/* Tab nav — hidden when the app sidebar controls the section */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        display: controlledTab !== undefined ? 'none' : 'flex', padding: '0 20px', gap: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600,
            color: tab === t.id ? '#2563eb' : '#64748b',
            borderBottom: `2px solid ${tab === t.id ? '#2563eb' : 'transparent'}`,
            marginBottom: -1,
          }}>
            {t.icon}{t.label}
            {t.badge ? (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                background: tab === t.id ? '#dbeafe' : '#f1f5f9',
                color: tab === t.id ? '#2563eb' : '#94a3b8',
              }}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Body — keyed by tab so each page switch replays the enter animation */}
      <div key={tab} className="anim-page" style={{
        background: '#fff', borderRadius: '0 0 22px 22px',
        boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)',
        border: '1px solid #eaeef4', borderTop: 'none', minHeight: 420,
      }}>
        {tab === 'build' && (
          <div>
            {/* Visit selector — visits live in a dropdown, not the side menu */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              padding: '16px 28px', borderBottom: '1px solid #e2e8f0', background: '#fafbfc',
            }}>
              <label htmlFor="visit-select" style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Visit
              </label>
              <VisitPicker
                visits={study.visits}
                activeVisitId={activeVisit?.id ?? ''}
                onSelect={id => { setActiveVisitId(id); setActiveFormId(''); }}
                onReorder={reorderVisitsById}
              />
              {activeVisit && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Pill>{activeVisit.kind === 'log' ? 'Continuous log' : 'Scheduled visit'}</Pill>
                  {activeVisit.window && <Pill bg="#eff6ff" color="#2563eb">Window {activeVisit.window}</Pill>}
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {activeVisit.forms.length} form{activeVisit.forms.length !== 1 ? 's' : ''} · {activeVisit.forms.reduce((a, f) => a + f.fields.length, 0)} fields
                  </span>
                </div>
              )}
              {/* RAG review filter — narrows the forms list and visible fields */}
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, padding: 3 }}>
                {([
                  { key: 'all', label: 'All', count: stats.total, color: '#475569' },
                  { key: 'accepted', label: 'Approved', count: stats.accepted, color: RAG.accepted },
                  { key: 'pending', label: 'Pending', count: stats.pending, color: RAG.pending },
                  { key: 'rejected', label: 'Rejected', count: stats.rejected, color: RAG.rejected },
                ] as const).map(f => {
                  const active = reviewFilter === f.key;
                  return (
                    <button key={f.key} onClick={() => setReviewFilter(f.key)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px',
                      borderRadius: 7, border: 'none', cursor: 'pointer',
                      background: active ? `${f.color}1a` : 'transparent',
                      color: active ? f.color : '#94a3b8', fontSize: 11.5, fontWeight: 700,
                    }}>
                      {f.key !== 'all' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: f.color }} />}
                      {f.label} {f.count}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                {activeVisit && (
                  <>
                    <button className="lift" title="Rename visit" onClick={() => {
                      const n = window.prompt('Rename visit', activeVisit.name);
                      if (n && n.trim()) renameVisit(activeVisit.id, n.trim());
                    }} style={visitCtlBtn}><Pencil size={13} /></button>
                    <button className="lift" title="Delete visit" onClick={() => {
                      if (window.confirm(`Delete visit "${activeVisit.name}" and its forms?`)) removeVisit(activeVisit.id);
                    }} style={visitCtlBtn}><Trash2 size={13} /></button>
                  </>
                )}
                <button className="lift" onClick={addVisit} style={{ ...visitCtlBtn, color: '#2563eb', borderColor: '#bfdbfe', width: 'auto', padding: '0 11px', gap: 6, fontWeight: 600, fontSize: 12.5 }}>
                  <Plus size={14} /> Visit
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', minHeight: 420 }}>
              {/* Forms side menu — the selected visit's form titles */}
              <div style={{
                width: 248, flexShrink: 0, borderRight: '1px solid #e2e8f0',
                padding: '16px 12px', background: '#fafbfc',
                maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 8px', marginBottom: 10 }}>
                  Forms
                </p>
                {(() => {
                  const visForms = (activeVisit?.forms ?? []).filter(f => reviewFilter === 'all' || f.fields.some(x => x.reviewStatus === reviewFilter));
                  const canReorder = reviewFilter === 'all' && !!activeVisit;
                  const row = (f: StudyForm, handle?: React.ReactNode) => {
                    const active = f.id === activeForm?.id;
                    const status = formReviewStatus(f);
                    const approvedCount = f.fields.filter(x => x.reviewStatus === 'accepted').length;
                    return (
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, marginBottom: 4, borderRadius: 9, background: active ? '#eff6ff' : 'transparent' }}>
                        {handle}
                        <button className="form-tab" onClick={() => setActiveFormId(f.id)} style={{
                          flex: 1, minWidth: 0, textAlign: 'left', padding: '10px 10px',
                          borderRadius: 9, border: 'none', cursor: 'pointer', background: 'transparent',
                          display: 'flex', alignItems: 'center', gap: 9,
                        }}>
                          <span style={{ color: active ? '#2563eb' : '#94a3b8', flexShrink: 0 }}>
                            {f.appliedTemplate ? <CircleDot size={15} /> : <FileText size={15} />}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? '#2563eb' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.name}
                            </span>
                            <span style={{ display: 'block', fontSize: 11, color: status === 'accepted' ? '#15803d' : status === 'rejected' ? '#b91c1c' : '#b45309' }}>
                              {approvedCount}/{f.fields.length} approved
                            </span>
                          </span>
                          <span title={status === 'accepted' ? 'All fields approved' : status === 'rejected' ? 'Has rejected fields' : 'Pending review'}
                            style={{ width: 9, height: 9, borderRadius: '50%', background: RAG[status], flexShrink: 0 }} />
                        </button>
                      </div>
                    );
                  };
                  if (!canReorder) return visForms.map(f => <div key={f.id}>{row(f)}</div>);
                  return (
                    <SortableList ids={visForms.map(f => f.id)} onReorder={(from, to) => activeVisit && reorderFormsByIndex(activeVisit.id, from, to)}>
                      {visForms.map(f => (
                        <SortableRow key={f.id} id={f.id}>
                          {({ setNodeRef, style, handleProps }) => (
                            <div ref={setNodeRef} style={style}>
                              {row(f, (
                                <span {...handleProps} title="Drag to reorder" style={{ display: 'flex', alignItems: 'center', color: '#cbd5e1', cursor: 'grab', paddingLeft: 3, touchAction: 'none' }}>
                                  <GripVertical size={13} />
                                </span>
                              ))}
                            </div>
                          )}
                        </SortableRow>
                      ))}
                    </SortableList>
                  );
                })()}
                {reviewFilter !== 'all' && (activeVisit?.forms ?? []).every(f => !f.fields.some(x => x.reviewStatus === reviewFilter)) && (
                  <p style={{ fontSize: 12, color: '#94a3b8', padding: '4px 8px', fontStyle: 'italic' }}>
                    No forms with {reviewFilter === 'accepted' ? 'approved' : reviewFilter} fields in this visit.
                  </p>
                )}
                {activeVisit && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="lift" onClick={() => addForm(activeVisit.id)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      padding: '9px', borderRadius: 9, border: '1px dashed #cbd5e1',
                      background: '#fff', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    }}>
                      <Plus size={14} /> Add blank form
                    </button>
                    <select
                      value=""
                      onChange={e => { if (e.target.value && activeVisit) { addForm(activeVisit.id, e.target.value); e.currentTarget.value = ''; } }}
                      style={{
                        width: '100%', padding: '9px', borderRadius: 9, border: '1px solid #e2e8f0',
                        background: '#fff', fontSize: 12.5, color: '#475569', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <option value="">+ Add standard form…</option>
                      {ALL_STANDARD_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {study.visits.some(v => v.id !== activeVisit.id && v.forms.length > 0) && (
                      <select
                        value=""
                        onChange={e => { if (e.target.value && activeVisit) { const [sv, sf] = e.target.value.split('::'); copyFormFrom(sv, sf, activeVisit.id); e.currentTarget.value = ''; } }}
                        style={{
                          width: '100%', padding: '9px', borderRadius: 9, border: '1px solid #e2e8f0',
                          background: '#fff', fontSize: 12.5, color: '#475569', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <option value="">+ Copy form from another visit…</option>
                        {study.visits.filter(v => v.id !== activeVisit.id && v.forms.length > 0).map(v => (
                          <optgroup key={v.id} label={v.name}>
                            {v.forms.map(f => <option key={f.id} value={`${v.id}::${f.id}`}>{f.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}
                    {/screen/i.test(activeVisit.name) && (
                      <button className="lift" onClick={() => sortFormsStandard(activeVisit.id)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px', borderRadius: 9, border: '1px solid #e2e8f0',
                        background: '#fafbfc', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>
                        <ListChecks size={13} /> Sort to standard order
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Active form — its headings (sections) and questions.
                  Keyed by form id so switching forms replays the enter animation. */}
              <div ref={contentRef} style={{
                flex: 1, padding: '22px 28px', minWidth: 0,
                maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
              }}>
                <div key={activeForm?.id ?? 'none'} className="anim-form">
                  {activeForm ? (
                    <FormBlock
                      form={activeForm}
                      filter={reviewFilter}
                      onField={mutateField}
                      onRule={setRuleAccepted}
                      onFormReview={setFormReview}
                      onEditField={openEdit}
                      onAddField={openAdd}
                      onUpdateForm={updateForm}
                      onRegenerate={handleRegenerate}
                      regenerating={regenId === activeForm.id}
                      onDeleteForm={() => activeVisit && removeForm(activeVisit.id, activeForm.id)}
                      onDuplicateForm={() => activeVisit && duplicateForm(activeVisit.id, activeForm.id)}
                      onReorderFields={reorderFormFields}
                      onAddSection={addSection}
                      onDuplicateContent={duplicateFormContent}
                      onDuplicateSection={duplicateSection}
                      onApplyToAllForms={applySectionToAllForms}
                      onDuplicateField={duplicateField}
                      onDeleteField={(formId, fieldId) => { if (window.confirm('Delete this field?')) deleteField(formId, fieldId); }}
                    />
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>This visit has no forms yet. Use “Add form” to create one.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'folders' && (
          <FoldersPanel
            visits={study.visits}
            onAddArm={addArm}
            onAddFolder={addFolderToArm}
            onRenameArm={renameArm}
            onRenameFolder={renameVisit}
            onDeleteFolder={removeVisit}
            onReorder={setVisits}
            onOpenFolder={(id) => { setActiveVisitId(id); setActiveFormId(''); setTab('build'); }}
          />
        )}
        {tab === 'settings' && (
          <SettingsPanel
            visits={study.visits}
            activeVisitId={activeVisitId}
            activeFormId={activeFormId}
            onReorderOptions={(formId, fieldId, options) => mutateField(formId, fieldId, { options })}
          />
        )}
        {tab === 'eligibility' && <EligibilityPanel eligibility={study.eligibility} />}
        {tab === 'intelligence' && (
          <FindingsPanel
            findings={study.findings}
            onResolve={(id, resolved) => setStudy({
              ...study,
              findings: study.findings.map(f => f.id === id ? { ...f, resolved } : f),
            })}
          />
        )}
        {tab === 'export' && <ExportPanel study={study} stats={stats} />}
      </div>

      <FieldEditorDrawer
        field={editTarget?.field ?? null}
        isNew={editTarget?.isNew ?? false}
        siblingFields={
          editTarget
            ? (study.visits.flatMap(v => v.forms).find(f => f.id === editTarget.formId)?.fields ?? [])
                .filter(f => f.id !== editTarget.field.id)
            : []
        }
        onSave={f => editTarget && saveField(editTarget.formId, f, editTarget.isNew)}
        onDelete={editTarget && !editTarget.isNew ? () => deleteField(editTarget.formId, editTarget.field.id) : undefined}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
}

function CounterChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '6px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.07)',
    }}>
      <span style={{ fontSize: 17, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{label}</span>
    </div>
  );
}

// RAG palette shared by field cards, form list dots, and filter chips.
const RAG: Record<ReviewStatus, string> = { accepted: '#22c55e', pending: '#f59e0b', rejected: '#ef4444' };

// A form's aggregate review status: red if anything is rejected, green when
// every field is approved, amber while anything is still pending.
function formReviewStatus(f: StudyForm): ReviewStatus {
  if (!f.fields.length) return 'pending';
  if (f.fields.some(x => x.reviewStatus === 'rejected')) return 'rejected';
  if (f.fields.every(x => x.reviewStatus === 'accepted')) return 'accepted';
  return 'pending';
}

// Group a form's fields into ordered sections (preserving first-seen order) so
// the questionnaire renders as titled subsections. Fields with no section fall
// into a single leading unlabeled group.
function groupFieldsBySection(fields: StudyField[]): { key: string; section: string | null; fields: StudyField[] }[] {
  const order: (string | null)[] = [];
  const bySection = new Map<string | null, StudyField[]>();
  for (const f of fields) {
    const key = f.section?.trim() || null;
    if (!bySection.has(key)) { bySection.set(key, []); order.push(key); }
    bySection.get(key)!.push(f);
  }
  return order.map((section, i) => ({
    key: section ?? `__nosection_${i}`,
    section,
    fields: bySection.get(section)!,
  }));
}

function FormBlock({ form, filter, onField, onRule, onFormReview, onEditField, onAddField, onUpdateForm, onRegenerate, regenerating, onDeleteForm, onDuplicateForm, onReorderFields, onAddSection, onDuplicateContent, onDuplicateSection, onApplyToAllForms, onDuplicateField, onDeleteField }: {
  form: StudyForm;
  filter: 'all' | ReviewStatus;
  onField: (formId: string, fieldId: string, patch: Partial<StudyField>) => void;
  onRule: (formId: string, ruleId: string, accepted: boolean) => void;
  onFormReview: (formId: string, status: ReviewStatus) => void;
  onEditField: (formId: string, field: StudyField) => void;
  onAddField: (formId: string) => void;
  onUpdateForm: (formId: string, patch: Partial<StudyForm>) => void;
  onRegenerate: (form: StudyForm) => void;
  regenerating: boolean;
  onDeleteForm: () => void;
  onDuplicateForm: () => void;
  onReorderFields: (formId: string, next: StudyField[]) => void;
  onAddSection: (formId: string) => void;
  onDuplicateContent: (formId: string) => void;
  onDuplicateSection: (formId: string, section: string | null) => void;
  onApplyToAllForms: (formId: string, section: string | null) => void;
  onDuplicateField: (formId: string, fieldId: string) => void;
  onDeleteField: (formId: string, fieldId: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const visibleFields = filter === 'all' ? form.fields : form.fields.filter(f => f.reviewStatus === filter);
  const hiddenCount = form.fields.length - visibleFields.length;
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 14, marginBottom: 18, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{form.name}</h3>
          {form.appliedTemplate && (
            <Pill bg="#f0fdf4" color="#15803d"><Check size={11} /> Template: {form.appliedTemplate}</Pill>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{form.fields.length} fields</span>
          <SmallBtn active={form.fields.length > 0 && form.fields.every(f => f.reviewStatus === 'accepted')}
            activeBg="#dcfce7" activeFg="#15803d"
            onClick={() => onFormReview(form.id, 'accepted')}><Check size={13} /> Approve all</SmallBtn>
          <SmallBtn active={form.fields.length > 0 && form.fields.every(f => f.reviewStatus === 'rejected')}
            activeBg="#fee2e2" activeFg="#b91c1c"
            onClick={() => onFormReview(form.id, 'rejected')}><X size={13} /> Reject all</SmallBtn>
          <SmallBtn active={false} onClick={() => onAddSection(form.id)}><Plus size={13} /> Add section</SmallBtn>
          <SmallBtn active={false} onClick={() => onDuplicateContent(form.id)}><CopyPlus size={13} /> Copy content</SmallBtn>
          <button className="lift" title="Customize prompt / regenerate" onClick={() => setShowPrompt(s => !s)} style={visitCtlBtn}>
            <RefreshCw size={13} color={showPrompt ? '#2563eb' : '#64748b'} />
          </button>
          <button className="lift" title="Duplicate form" onClick={onDuplicateForm} style={visitCtlBtn}><Copy size={13} /></button>
          <button className="lift" title="Rename form" onClick={() => {
            const n = window.prompt('Rename form', form.name);
            if (n && n.trim()) onUpdateForm(form.id, { name: n.trim() });
          }} style={visitCtlBtn}><Pencil size={13} /></button>
          <button className="lift" title="Delete form" onClick={() => {
            if (window.confirm(`Delete form "${form.name}"?`)) onDeleteForm();
          }} style={visitCtlBtn}><Trash2 size={13} /></button>
        </div>
        {form.description && <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{form.description}</p>}
      </div>

      {/* Form header / instructions — free text shown at the top of the form */}
      <div style={{ padding: '10px 18px', background: '#fffdf5', borderBottom: '1px solid #f1f5f9' }}>
        <label style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', letterSpacing: 0.3, textTransform: 'uppercase' }}>Header / instructions</label>
        <textarea
          value={form.header ?? ''}
          onChange={e => onUpdateForm(form.id, { header: e.target.value })}
          placeholder="Add instructions or a header shown at the top of this form…"
          rows={form.header ? 2 : 1}
          style={{
            width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8,
            border: '1px solid #fde68a', background: '#fff', fontSize: 13, fontFamily: 'inherit',
            color: '#1e293b', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5,
          }}
        />
      </div>

      {/* Per-form prompt + regenerate */}
      {showPrompt && (
        <div style={{ padding: '12px 18px', background: '#fbfcfe', borderBottom: '1px solid #eef2f7' }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Form instructions
          </label>
          <textarea
            value={form.prompt ?? ''}
            onChange={e => onUpdateForm(form.id, { prompt: e.target.value })}
            placeholder="Tell the AI how to (re)build this form — e.g. “add a Comments field”, “use 24-hour time”, “include all CTCAE grades”…"
            rows={2}
            style={{
              width: '100%', marginTop: 6, padding: '9px 11px', borderRadius: 9,
              border: '1.5px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit',
              color: '#1e293b', resize: 'vertical', boxSizing: 'border-box', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="lift" disabled={regenerating} onClick={() => onRegenerate(form)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9,
              border: 'none', background: regenerating ? '#cbd5e1' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: regenerating ? 'wait' : 'pointer',
            }}>
              <RefreshCw size={13} style={regenerating ? { animation: 'spin 1s linear infinite' } : undefined} />
              {regenerating ? 'Regenerating…' : 'Regenerate this form'}
            </button>
          </div>
        </div>
      )}

      <div>
        {hiddenCount > 0 && (
          <p style={{ padding: '8px 18px', fontSize: 12, color: '#94a3b8', background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
            {hiddenCount} field{hiddenCount !== 1 ? 's' : ''} hidden by the “{filter === 'accepted' ? 'Approved' : filter === 'pending' ? 'Pending' : 'Rejected'}” filter.
          </p>
        )}
        {(() => {
          // Reorder only in the unfiltered view, where order === true order.
          const canReorder = filter === 'all';
          const groups = groupFieldsBySection(visibleFields);

          const sectionHeader = (section: string, count: number, handle?: React.ReactNode) => (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #eef2f7',
            }}>
              {handle}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.4, textTransform: 'uppercase' }}>{section}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{count} question{count !== 1 ? 's' : ''}</span>
              {canReorder && (
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button className="lift" title={`Duplicate the “${section}” section in this form`} onClick={() => onDuplicateSection(form.id, section)} style={reorderBtn(false)}><Copy size={12} /></button>
                  <button className="lift" title={`Copy the “${section}” section to every form`} onClick={() => {
                    if (window.confirm(`Add the “${section}” section to every form in the study that doesn’t already have it?`)) onApplyToAllForms(form.id, section);
                  }} style={reorderBtn(false)}><CopyPlus size={12} /></button>
                </span>
              )}
            </div>
          );

          const fieldCard = (field: StudyField, handle?: React.ReactNode) => (
            <FieldCard field={field}
              onChange={patch => onField(form.id, field.id, patch)}
              onEdit={() => onEditField(form.id, field)}
              onDuplicate={() => onDuplicateField(form.id, field.id)}
              onDelete={() => onDeleteField(form.id, field.id)}
              dragHandle={handle} />
          );

          if (!canReorder) {
            return groups.map((group, gi) => (
              <div key={group.key} className="anim-row" style={{ animationDelay: `${Math.min(gi * 55, 280)}ms` }}>
                {group.section && sectionHeader(group.section, group.fields.length)}
                {group.fields.map(field => <div key={field.id}>{fieldCard(field)}</div>)}
              </div>
            ));
          }

          // One flat drag list of section headers + fields. Dragging a field
          // across a header moves it INTO that section; dragging a header moves
          // the whole section. Empty sections (a header with no following fields)
          // simply disappear, matching how sections are derived from fields.
          type Item = { id: string; kind: 'header'; section: string } | { id: string; kind: 'field'; field: StudyField };
          const items: Item[] = [];
          for (const g of groups) {
            if (g.section) items.push({ id: `sec::${g.section}`, kind: 'header', section: g.section });
            for (const f of g.fields) items.push({ id: f.id, kind: 'field', field: f });
          }
          const counts = new Map(groups.map(g => [g.section, g.fields.length]));

          const onReorder = (from: number, to: number) => {
            const next = arrayMove(items, from, to);
            let curSection: string | undefined = undefined;
            const out: StudyField[] = [];
            for (const it of next) {
              if (it.kind === 'header') curSection = it.section;
              else out.push({ ...it.field, section: curSection });
            }
            onReorderFields(form.id, out);
          };

          return (
            <SortableList ids={items.map(i => i.id)} onReorder={onReorder}>
              {items.map(it => (
                <SortableRow key={it.id} id={it.id}>
                  {({ setNodeRef, style, handleProps }) => {
                    const grip = (
                      <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', alignItems: 'center', color: '#cbd5e1', cursor: 'grab', touchAction: 'none' }}>
                        <GripVertical size={it.kind === 'header' ? 14 : 13} />
                      </span>
                    );
                    return (
                      <div ref={setNodeRef} style={style}>
                        {it.kind === 'header'
                          ? sectionHeader(it.section, counts.get(it.section) ?? 0, grip)
                          : fieldCard(it.field, grip)}
                      </div>
                    );
                  }}
                </SortableRow>
              ))}
            </SortableList>
          );
        })()}
      </div>

      {/* Add field */}
      <button onClick={() => onAddField(form.id)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: '11px', border: 'none', borderTop: '1px dashed #e2e8f0',
        background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        <Plus size={15} /> Add field to {form.name}
      </button>

      {form.rules.length > 0 && (
        <div style={{ padding: '14px 18px', background: '#fafbff', borderTop: '1px solid #eef2f7' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardCheck size={13} /> Suggested edit checks
          </p>
          {form.rules.map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
              borderBottom: '1px solid #eef2f7',
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.4 }}>{rule.description}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <Pill bg="#f3e8ff" color="#7c3aed">{rule.ruleType}</Pill>
                  <ConfidenceBadge level={rule.confidence} compact />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <SmallBtn active={rule.accepted === true} activeBg="#dcfce7" activeFg="#15803d"
                  onClick={() => onRule(form.id, rule.id, true)}><Check size={13} /> Accept</SmallBtn>
                <SmallBtn active={rule.accepted === false} activeBg="#fee2e2" activeFg="#b91c1c"
                  onClick={() => onRule(form.id, rule.id, false)}><X size={13} /> Reject</SmallBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      <FormAlerts form={form} onUpdateForm={onUpdateForm} />
    </div>
  );
}

const ALERT_COLORS: Record<'info' | 'warning' | 'critical', { bg: string; fg: string }> = {
  info: { bg: '#eff6ff', fg: '#2563eb' },
  warning: { bg: '#fffbeb', fg: '#b45309' },
  critical: { bg: '#fef2f2', fg: '#b91c1c' },
};
let newAlertCounter = 0;

function FormAlerts({ form, onUpdateForm }: { form: StudyForm; onUpdateForm: (formId: string, patch: Partial<StudyForm>) => void }) {
  const alerts = form.alerts ?? [];
  const setAlerts = (next: StudyForm['alerts']) => onUpdateForm(form.id, { alerts: next });

  const addAlert = () => {
    const message = window.prompt('Alert message (e.g. “Notify PI immediately if the AE is serious”)');
    if (!message || !message.trim()) return;
    newAlertCounter += 1;
    setAlerts([...alerts, { id: `al-${Date.now()}-${newAlertCounter}`, level: 'warning', message: message.trim() }]);
  };
  const cycleLevel = (id: string) =>
    setAlerts(alerts.map(a => a.id !== id ? a : { ...a, level: a.level === 'info' ? 'warning' : a.level === 'warning' ? 'critical' : 'info' }));
  const editAlert = (id: string) => {
    const a = alerts.find(x => x.id === id);
    const message = window.prompt('Edit alert message', a?.message);
    if (message !== null) setAlerts(alerts.map(x => x.id !== id ? x : { ...x, message }));
  };
  const removeAlert = (id: string) => setAlerts(alerts.filter(a => a.id !== id));

  return (
    <div style={{ padding: '14px 18px', background: '#fff', borderTop: '1px solid #eef2f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: alerts.length ? 10 : 0 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', letterSpacing: 0.4, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} /> Alerts
        </p>
        <button className="lift" onClick={addAlert} style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
          borderRadius: 7, border: '1px solid #fde68a', background: '#fffbeb', color: '#b45309',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}><Plus size={13} /> Add alert</button>
      </div>
      {alerts.map(a => {
        const c = ALERT_COLORS[a.level];
        const fld = a.fieldId ? form.fields.find(f => f.id === a.fieldId) : undefined;
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <button className="lift" onClick={() => cycleLevel(a.id)} title="Cycle severity" style={{
              border: 'none', cursor: 'pointer', padding: '3px 9px', borderRadius: 20,
              background: c.bg, color: c.fg, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3,
            }}>{a.level}</button>
            <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>
              {a.message}
              {fld && <span style={{ fontSize: 11, color: '#94a3b8' }}> · on “{fld.label}”</span>}
            </span>
            <button className="lift" onClick={() => editAlert(a.id)} style={visitCtlBtn} aria-label="Edit alert"><Pencil size={12} /></button>
            <button className="lift" onClick={() => removeAlert(a.id)} style={visitCtlBtn} aria-label="Remove alert"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

function FieldCard({ field, onChange, onEdit, onDuplicate, onDelete, dragHandle }: {
  field: StudyField;
  onChange: (patch: Partial<StudyField>) => void;
  onEdit: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  dragHandle?: React.ReactNode;
}) {
  const flagged = field.confidence === 'low' && field.reviewStatus === 'pending';

  // RAG coding: green = approved, amber = pending action, red = rejected.
  const statusBg: Record<ReviewStatus, string> = {
    pending: '#fffdf4', accepted: '#f0fdf4', rejected: '#fef2f2',
  };
  const leftBar: Record<ReviewStatus, string> = {
    pending: '#f59e0b', accepted: '#22c55e', rejected: '#ef4444',
  };

  return (
    <div style={{
      padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
      borderLeft: `3px solid ${leftBar[field.reviewStatus]}`,
      background: statusBg[field.reviewStatus],
      opacity: field.reviewStatus === 'rejected' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {dragHandle && (
          <div style={{ flexShrink: 0, paddingTop: 2 }}>{dragHandle}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>
            {field.label}
            {field.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
          </label>

          {field.completionGuidance && (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 8px', lineHeight: 1.4 }}>
              {field.completionGuidance}
            </p>
          )}

          <div style={{ marginTop: field.completionGuidance ? 0 : 8 }}>
            <FieldInput field={field} disabled={field.reviewStatus === 'rejected'} />
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            <TypeBadge type={field.type} />
            <ConfidenceBadge level={field.confidence} compact />
            {flagged && <Pill bg="#fffbeb" color="#b45309"><AlertTriangle size={11} /> Needs review</Pill>}
            {field.alert && (
              <Pill bg={ALERT_COLORS[field.alert.level].bg} color={ALERT_COLORS[field.alert.level].fg}>
                <AlertTriangle size={11} /> {field.alert.message || 'Alert'}
              </Pill>
            )}
            {field.condition && (
              <Pill bg="#eef2ff" color="#4f46e5"><Split size={11} /> Conditional</Pill>
            )}
          </div>

          {field.originalText && (
            <p style={{
              fontSize: 11.5, color: '#94a3b8', marginTop: 6, paddingLeft: 8,
              borderLeft: '2px solid #e2e8f0', fontStyle: 'italic', lineHeight: 1.45,
            }}>
              “{field.originalText}”
            </p>
          )}
        </div>

        {/* Review controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <SmallBtn active={field.reviewStatus === 'accepted'} activeBg="#dcfce7" activeFg="#15803d"
            onClick={() => onChange({ reviewStatus: 'accepted' })}><Check size={13} /> Accept</SmallBtn>
          <SmallBtn active={false} onClick={onEdit}><Pencil size={13} /> Edit</SmallBtn>
          {onDuplicate && <SmallBtn active={false} onClick={onDuplicate}><Copy size={13} /> Copy</SmallBtn>}
          <SmallBtn active={field.reviewStatus === 'rejected'} activeBg="#fee2e2" activeFg="#b91c1c"
            onClick={() => onChange({ reviewStatus: 'rejected' })}><X size={13} /> Reject</SmallBtn>
          {onDelete && (
            <button onClick={onDelete} className="lift" title="Delete field" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center',
              padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 78,
            }}><Trash2 size={13} /> Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Renders the actual data-entry control for a field, matching its type.
function FieldInput({ field, disabled }: { field: StudyField; disabled: boolean }) {
  const base: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    border: '1.5px solid #cbd5e1', background: disabled ? '#f8fafc' : '#fff',
    fontSize: 13.5, color: '#1e293b', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const choice: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5,
    color: disabled ? '#94a3b8' : '#334155', cursor: disabled ? 'default' : 'pointer',
  };
  const opts = field.options ?? [];
  const noOpts = <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No options defined.</span>;

  // A "dropdown" behaves as a single-choice select.
  const ftype = (field.type as string) === 'dropdown' ? 'select' : field.type;
  switch (ftype) {
    case 'textarea':
      return <textarea rows={2} disabled={disabled} placeholder="Enter response"
        style={{ ...base, resize: 'vertical', minHeight: 56, lineHeight: 1.5 }} />;
    case 'number':
    case 'integer':
      return <input type="number" step={field.type === 'integer' ? 1 : 'any'} disabled={disabled} placeholder="0" style={base} />;
    case 'decimal':
      return <input type="number" step="any" disabled={disabled} placeholder="0.0" style={base} />;
    case 'date':
      // When a template date format is set, preview it as a formatted text field.
      return field.format
        ? <input type="text" disabled={disabled} placeholder={field.format} style={base} />
        : <input type="date" disabled={disabled} style={base} />;
    case 'datetime':
      return field.format
        ? <input type="text" disabled={disabled} placeholder={field.format} style={base} />
        : <input type="datetime-local" disabled={disabled} style={base} />;
    case 'time':
      return <input type="time" disabled={disabled} style={base} />;
    case 'select':
      return (
        <select disabled={disabled} defaultValue="" style={base}>
          <option value="" disabled>Select…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="N/A">N/A</option>
        </select>
      );
    case 'multiselect':
    case 'checkbox':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opts.length ? opts.map(o => (
            <label key={o} style={choice}>
              <input type="checkbox" disabled={disabled} style={{ accentColor: '#2563eb' }} /> {o}
            </label>
          )) : noOpts}
        </div>
      );
    case 'radio':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opts.length ? opts.map(o => (
            <label key={o} style={choice}>
              <input type="radio" name={field.id} disabled={disabled} style={{ accentColor: '#2563eb' }} /> {o}
            </label>
          )) : noOpts}
        </div>
      );
    case 'yesno':
      return (
        <select disabled={disabled} defaultValue="" style={base}>
          <option value="" disabled>Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    case 'signature':
      return (
        <div style={{
          ...base, borderStyle: 'dashed', height: 56, display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          color: '#94a3b8', fontStyle: 'italic', cursor: disabled ? 'default' : 'pointer',
        }}>
          <PenLine size={15} /> Sign here
        </div>
      );
    case 'file':
      return (
        <div style={{
          ...base, borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 8, color: '#64748b',
          cursor: disabled ? 'default' : 'pointer',
        }}>
          <Upload size={15} /> <span style={{ fontSize: 13 }}>Upload file</span>
        </div>
      );
    case 'calculated':
      return <input type="text" readOnly disabled
        placeholder={field.expression ? `= ${field.expression}` : 'Calculated value'}
        style={{ ...base, background: '#f8fafc', color: '#64748b', fontStyle: 'italic' }} />;
    case 'text':
    default:
      return <input type="text" disabled={disabled} placeholder="Enter response" style={base} />;
  }
}

// Visit selector — a custom dropdown (native <select> can't drag-sort options)
// whose items can be reordered by dragging the grip handle.
// Display order of the known arms in the tree; custom arms sort after these.
const ARM_ORDER: string[] = ['Study Visit', 'General', 'Unscheduled Visit', 'SAE', 'Early Termination', 'Reconsent'];
const armRank = (a?: string) => { const i = ARM_ORDER.indexOf(a ?? 'Study Visit'); return i === -1 ? ARM_ORDER.length : i; };
// Stable arm ordering: known arms first (canonical order), then custom arms in
// first-seen order so a newly created arm keeps its place.
function orderedArms(visits: StudyVisit[]): string[] {
  const seen: string[] = [];
  for (const v of visits) { const a = v.arm ?? 'Study Visit'; if (!seen.includes(a)) seen.push(a); }
  return seen.sort((a, b) => (armRank(a) - armRank(b)) || (seen.indexOf(a) - seen.indexOf(b)));
}

function VisitPicker({ visits, activeVisitId, onSelect, onReorder }: {
  visits: StudyVisit[];
  activeVisitId: string;
  onSelect: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = visits.find(v => v.id === activeVisitId);
  const label = (v: StudyVisit) => `${v.name}${v.timing ? ` — ${v.timing}` : ''}${v.kind === 'log' ? ' (log)' : ''}`;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);

  // Group visits into arms (folders) in canonical arm order.
  const arms = orderedArms(visits);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 280, maxWidth: '100%' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9,
        border: '1.5px solid #cbd5e1', background: '#fff', fontSize: 14, fontWeight: 600, color: '#1e293b',
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active ? `${active.arm ?? 'Study Visit'} › ${label(active)}` : 'Select visit'}
        </span>
        <ChevronDown size={16} color="#64748b" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, minWidth: 320,
          maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 10, boxShadow: '0 14px 34px rgba(15,23,42,0.20)', padding: 4,
        }}>
          {arms.map(arm => {
            const armVisits = visits.filter(v => (v.arm ?? 'Study Visit') === arm);
            const ids = armVisits.map(v => v.id);
            return (
              <div key={arm} style={{ marginBottom: 4 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 8px 2px' }}>{arm}</p>
                <SortableList ids={ids} onReorder={(from, to) => onReorder(ids[from], ids[to])}>
                  {armVisits.map(v => (
                    <SortableRow key={v.id} id={v.id}>
                      {({ setNodeRef, style, handleProps }) => (
                        <div ref={setNodeRef} style={{
                          ...style, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8,
                          background: v.id === activeVisitId ? '#eff6ff' : 'transparent',
                        }}>
                          <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', color: '#cbd5e1', cursor: 'grab', padding: '0 2px 0 5px', touchAction: 'none' }}>
                            <GripVertical size={14} />
                          </span>
                          <button onClick={() => { onSelect(v.id); setOpen(false); }} style={{
                            flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px 8px', fontSize: 13.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            {v.id === activeVisitId ? <Check size={14} color="#2563eb" style={{ flexShrink: 0 }} /> : <span style={{ width: 14, flexShrink: 0 }} />}
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(v)}</span>
                          </button>
                        </div>
                      )}
                    </SortableRow>
                  ))}
                </SortableList>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Folders tab — arms (main folders) → folders (visits). Create/rename arms,
// add/rename/delete folders, and drag folders across arms (a flat sortable list
// of arm-headers + folder-rows; the drop position sets each folder's arm).
function FoldersPanel({ visits, onAddArm, onAddFolder, onRenameArm, onRenameFolder, onDeleteFolder, onReorder, onOpenFolder }: {
  visits: StudyVisit[];
  onAddArm: () => void;
  onAddFolder: (arm: string) => void;
  onRenameArm: (oldName: string, newName: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onReorder: (next: StudyVisit[]) => void;
  onOpenFolder: (id: string) => void;
}) {
  type Item = { kind: 'arm'; id: string; arm: string } | { kind: 'folder'; id: string; visit: StudyVisit };
  const items: Item[] = [];
  for (const arm of orderedArms(visits)) {
    items.push({ kind: 'arm', id: `arm::${arm}`, arm });
    for (const v of visits.filter(x => (x.arm ?? 'Study Visit') === arm)) items.push({ kind: 'folder', id: v.id, visit: v });
  }
  const onDrop = (from: number, to: number) => {
    const next = arrayMove(items, from, to);
    let cur = 'Study Visit';
    const out: StudyVisit[] = [];
    for (const it of next) {
      if (it.kind === 'arm') cur = it.arm;
      else out.push({ ...it.visit, arm: cur });
    }
    onReorder(out);
  };
  const grip = (handleProps: Record<string, unknown>) => (
    <span {...handleProps} title="Drag to reorder / move to another arm" style={{ display: 'inline-flex', color: '#cbd5e1', cursor: 'grab', touchAction: 'none' }}><GripVertical size={15} /></span>
  );
  return (
    <div className="anim-form" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <FolderTree size={18} color="#2563eb" />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Folders</h2>
        <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>Drag a folder onto another arm to move it. Arms are main folders.</span>
        <button className="lift" onClick={onAddArm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> New arm
        </button>
      </div>
      <SortableList ids={items.map(i => i.id)} onReorder={onDrop}>
        {items.map(it => (
          <SortableRow key={it.id} id={it.id}>
            {({ setNodeRef, style, handleProps }) => (
              it.kind === 'arm' ? (
                <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginTop: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 9 }}>
                  {grip(handleProps)}
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}>{it.arm}</span>
                  <button className="lift" title="Rename arm" onClick={() => { const n = window.prompt('Rename arm', it.arm); if (n) onRenameArm(it.arm, n); }} style={miniIconBtn}><Pencil size={13} /></button>
                  <button className="lift" title="Add folder to this arm" onClick={() => onAddFolder(it.arm)} style={{ ...miniIconBtn, width: 'auto', padding: '0 9px', gap: 5, color: '#2563eb', borderColor: '#bfdbfe', fontSize: 12, fontWeight: 600 }}><Plus size={13} /> Folder</button>
                </div>
              ) : (
                <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginLeft: 20, marginTop: 4, background: '#fafbfc', border: '1px solid #e8edf4', borderRadius: 9 }}>
                  {grip(handleProps)}
                  <Folder size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                  <button onClick={() => onOpenFolder(it.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
                    {it.visit.name}
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}> · {it.visit.forms.length} form{it.visit.forms.length !== 1 ? 's' : ''}</span>
                  </button>
                  <button className="lift" title="Rename folder" onClick={() => { const n = window.prompt('Rename folder', it.visit.name); if (n && n.trim()) onRenameFolder(it.id, n.trim()); }} style={miniIconBtn}><Pencil size={13} /></button>
                  <button className="lift" title="Delete folder" onClick={() => { if (window.confirm(`Delete folder "${it.visit.name}" and its forms?`)) onDeleteFolder(it.id); }} style={{ ...miniIconBtn, color: '#dc2626', borderColor: '#fecaca' }}><Trash2 size={13} /></button>
                </div>
              )
            )}
          </SortableRow>
        ))}
      </SortableList>
    </div>
  );
}

const miniIconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0 };

// eSource Settings tab — drag-reorder the answer options of dropdown/select
// fields in the active form.
function SettingsPanel({ visits, activeVisitId, activeFormId, onReorderOptions }: {
  visits: StudyVisit[];
  activeVisitId: string;
  activeFormId: string;
  onReorderOptions: (formId: string, fieldId: string, options: string[]) => void;
}) {
  const visit = visits.find(v => v.id === activeVisitId) ?? visits[0];
  const form = visit?.forms.find(f => f.id === activeFormId) ?? visit?.forms[0];
  const isDropdown = (f: StudyField) => (f.type === 'select' || (f.type as string) === 'dropdown') && (f.options?.length ?? 0) > 0;
  const selects = (form?.fields ?? []).filter(isDropdown);

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 14, border: '1px solid #e8edf4', padding: '14px 18px', marginBottom: 12,
  };

  return (
    <div className="anim-form" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <SlidersHorizontal size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>eSource Settings</h2>
          <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
            Drag to reorder the answer options of each dropdown field. Showing dropdowns for{' '}
            <b style={{ color: '#334155' }}>{form?.name ?? '—'}</b>{visit ? ` · ${visit.name}` : ''} — change the form in <b style={{ color: '#334155' }}>Study Build</b>.
          </p>
        </div>
      </div>

      {!form ? (
        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>No form selected.</p>
      ) : selects.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
          “{form.name}” has no dropdown fields to configure.
        </p>
      ) : (
        selects.map(field => (
          <div key={field.id} style={cardStyle}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{field.label}</p>
            <p style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 10 }}>{field.options!.length} options · drag to reorder</p>
            <SortableList
              ids={field.options!.map((_, i) => `${field.id}-opt-${i}`)}
              onReorder={(from, to) => onReorderOptions(form.id, field.id, arrayMove(field.options!, from, to))}
            >
              {field.options!.map((opt, i) => (
                <SortableRow key={`${field.id}-opt-${i}`} id={`${field.id}-opt-${i}`}>
                  {({ setNodeRef, style, handleProps }) => (
                    <div ref={setNodeRef} style={{
                      ...style, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                      border: '1px solid #e8edf4', borderRadius: 9, background: '#fafbfc', marginBottom: 6,
                    }}>
                      <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', color: '#cbd5e1', cursor: 'grab', touchAction: 'none' }}>
                        <GripVertical size={15} />
                      </span>
                      <span style={{ fontSize: 13.5, color: '#1e293b' }}>{opt}</span>
                    </div>
                  )}
                </SortableRow>
              ))}
            </SortableList>
          </div>
        ))
      )}
    </div>
  );
}

function SmallBtn({ children, onClick, active, activeBg, activeFg }: {
  children: React.ReactNode; onClick: () => void;
  active: boolean; activeBg?: string; activeFg?: string;
}) {
  return (
    <button onClick={onClick} className="lift" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center',
      padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
      border: `1px solid ${active ? (activeFg ?? '#2563eb') + '40' : '#e2e8f0'}`,
      background: active ? (activeBg ?? '#dbeafe') : '#fff',
      color: active ? (activeFg ?? '#2563eb') : '#64748b',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 78,
    }}>
      {children}
    </button>
  );
}
