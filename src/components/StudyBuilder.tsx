import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers, AlertTriangle, FileOutput, RotateCcw, Check, Pencil, FlaskConical,
  ListChecks, Plus, FileText, CircleDot, Save, Trash2, GripVertical, SlidersHorizontal, FolderTree,
} from 'lucide-react';
import type {
  StudyModel, StudyField, StudyForm, StudyVisit, ReviewStatus,
} from '../types/study';
import { regenerateForm, saveStudy } from '../utils/api';
import { ALL_STANDARD_NAMES, canonicalRank } from '../utils/standardForms';
import { arrayMove } from '@dnd-kit/sortable';
import { SortableList, SortableRow } from './dnd';
import { Pill } from './ui';
import EligibilityPanel from './EligibilityPanel';
import FindingsPanel from './FindingsPanel';
import ExportPanel from './ExportPanel';
import FieldEditorDrawer from './FieldEditorDrawer';
import { visitCtlBtn, RAG, formReviewStatus, groupFieldsBySection } from './study/shared';
import { CounterChip, FormBlock, VisitPicker, FoldersPanel, SettingsPanel } from './study/components';

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
