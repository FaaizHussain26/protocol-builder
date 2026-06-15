import type { StudyModel } from '../types/study';

// A representative study used for offline demos (load via #demo).
export const DEMO_STUDY: StudyModel = {
  studyTitle: 'Phase II Study of XYZ-123 in Moderate Hypertension',
  studyDescription:
    'A randomized, double-blind study evaluating the efficacy and safety of XYZ-123 in adults aged 18–65 with moderate essential hypertension.',
  sponsor: 'Acme Therapeutics Inc.',
  phase: 'Phase II',
  indication: 'Essential Hypertension',
  documents: [
    { name: 'XYZ-123_Protocol_v2.pdf', docType: 'Protocol', sizeBytes: 482000 },
    { name: 'Schedule_of_Assessments.pdf', docType: 'Schedule of Assessments', sizeBytes: 96000 },
    { name: 'Central_Lab_Manual.pdf', docType: 'Lab Manual', sizeBytes: 154000 },
  ],
  visits: [
    {
      id: 'v1', name: 'Screening', kind: 'visit', timing: 'Day -28 to -1',
      forms: [
        {
          id: 'v1f1', name: 'Demographics', appliedTemplate: null,
          fields: [
            { id: 'f1', label: 'Date of Birth', type: 'date', required: true, confidence: 'high', completionGuidance: 'Enter the participant’s date of birth from a source document.', source: 'Protocol §4.1', reviewStatus: 'pending' },
            { id: 'f2', label: 'Sex at Birth', type: 'radio', required: true, options: ['Male', 'Female'], confidence: 'high', completionGuidance: 'Record sex as documented in the medical record.', source: 'Protocol §4.1', reviewStatus: 'pending' },
            { id: 'f3', label: 'Ethnicity', type: 'select', required: false, options: ['Hispanic or Latino', 'Not Hispanic or Latino', 'Not reported'], confidence: 'low', completionGuidance: 'Self-reported; leave blank if the participant declines.', source: 'Inferred', reviewStatus: 'pending' },
          ],
          rules: [
            { id: 'r1', description: 'Date of Birth must result in age between 18 and 65 at screening.', ruleType: 'range', confidence: 'high', accepted: null },
          ],
        },
        {
          id: 'v1f2', name: 'Vital Signs', appliedTemplate: 'Vital Signs',
          fields: [
            { id: 'f4', label: 'Systolic BP (mmHg)', type: 'number', required: true, confidence: 'high', completionGuidance: 'Measure after 5 minutes seated rest. Record in mmHg.', source: 'SoA', reviewStatus: 'pending' },
            { id: 'f5', label: 'Diastolic BP (mmHg)', type: 'number', required: true, confidence: 'high', completionGuidance: 'Measure on the same arm as systolic.', source: 'SoA', reviewStatus: 'pending' },
            { id: 'f6', label: 'Heart Rate (bpm)', type: 'number', required: true, confidence: 'medium', completionGuidance: 'Record resting heart rate.', source: 'SoA', reviewStatus: 'pending' },
          ],
          rules: [
            { id: 'r2', description: 'Systolic BP must be between 60 and 250 mmHg.', ruleType: 'range', confidence: 'high', accepted: null },
            { id: 'r3', description: 'Screening systolic BP should be 140–179 mmHg to meet eligibility.', ruleType: 'cross-field', confidence: 'medium', accepted: null },
          ],
        },
      ],
    },
    {
      id: 'v2', name: 'Baseline / Day 1', kind: 'visit', timing: 'Day 1',
      forms: [
        {
          id: 'v2f1', name: 'Randomization', appliedTemplate: null,
          fields: [
            { id: 'f7', label: 'Randomization Number', type: 'text', required: true, confidence: 'high', completionGuidance: 'Auto-assigned by the IWRS; transcribe exactly.', source: 'Protocol §5.2', reviewStatus: 'pending' },
            { id: 'f8', label: 'Treatment Arm', type: 'select', required: true, options: ['XYZ-123', 'Placebo'], confidence: 'low', completionGuidance: 'Typically blinded; confirm whether this should be captured at the site.', source: 'Inferred', reviewStatus: 'pending' },
          ],
          rules: [],
        },
      ],
    },
    {
      id: 'v3', name: 'Week 12 / End of Treatment', kind: 'visit', timing: 'Week 12', window: '±5 days',
      forms: [
        {
          id: 'v3f1', name: 'End of Treatment', appliedTemplate: null,
          fields: [
            { id: 'f9', label: 'Completion Status', type: 'radio', required: true, options: ['Completed', 'Discontinued'], confidence: 'high', completionGuidance: 'Select whether the participant completed the treatment period.', source: 'Protocol §6.4', reviewStatus: 'pending' },
            { id: 'f10', label: 'Reason for Discontinuation', type: 'textarea', required: false, confidence: 'medium', completionGuidance: 'Complete only if discontinued.', source: 'Protocol §6.4', reviewStatus: 'pending' },
          ],
          rules: [
            { id: 'r4', description: 'If Completion Status is "Discontinued", Reason for Discontinuation is required.', ruleType: 'required-if', confidence: 'high', accepted: null },
          ],
        },
      ],
    },
    {
      id: 'log1', name: 'Adverse Event Log', kind: 'log',
      forms: [
        {
          id: 'log1f1', name: 'Adverse Events', appliedTemplate: 'Adverse Event Log',
          fields: [
            { id: 'f11', label: 'AE Term', type: 'text', required: true, confidence: 'high', completionGuidance: 'Record the diagnosis or symptom using standard terminology.', source: 'Protocol §8.1', reviewStatus: 'pending' },
            { id: 'f12', label: 'Severity', type: 'select', required: true, options: ['Mild', 'Moderate', 'Severe'], confidence: 'high', completionGuidance: 'Grade per protocol severity scale.', source: 'Protocol §8.1', reviewStatus: 'pending' },
            { id: 'f13', label: 'Serious?', type: 'yesno', required: true, confidence: 'high', completionGuidance: 'Mark Yes if the event meets any seriousness criterion.', source: 'Protocol §8.2', reviewStatus: 'pending' },
            { id: 'f14', label: 'Relationship to Study Drug', type: 'select', required: true, options: ['Not related', 'Possibly related', 'Probably related', 'Definitely related'], confidence: 'medium', completionGuidance: 'Investigator’s causality assessment.', source: 'Protocol §8.2', reviewStatus: 'pending' },
          ],
          rules: [
            { id: 'r5', description: 'If "Serious?" is Yes, the SAE form is required.', ruleType: 'required-if', confidence: 'high', accepted: null },
          ],
        },
      ],
    },
    {
      id: 'log2', name: 'Concomitant Medication Log', kind: 'log',
      forms: [
        {
          id: 'log2f1', name: 'Concomitant Medications', appliedTemplate: 'Concomitant Medication Log',
          fields: [
            { id: 'f15', label: 'Medication Name', type: 'text', required: true, confidence: 'high', completionGuidance: 'Record the trade or generic name.', source: 'Protocol §7.3', reviewStatus: 'pending' },
            { id: 'f16', label: 'Indication', type: 'text', required: true, confidence: 'medium', completionGuidance: 'Reason the medication was taken.', source: 'Protocol §7.3', reviewStatus: 'pending' },
            { id: 'f17', label: 'Start Date', type: 'date', required: true, confidence: 'high', completionGuidance: 'Date the medication was first taken.', source: 'Protocol §7.3', reviewStatus: 'pending' },
          ],
          rules: [],
        },
      ],
    },
  ],
  eligibility: [
    { id: 'e1', kind: 'inclusion', criterion: 'Adults aged 18 to 65 years.', logic: 'PASS if age ≥ 18 AND age ≤ 65 at screening.', confidence: 'high' },
    { id: 'e2', kind: 'inclusion', criterion: 'Moderate essential hypertension (systolic BP 140–179 mmHg at screening).', logic: 'PASS if 140 ≤ screening systolic BP ≤ 179.', confidence: 'high' },
    { id: 'e3', kind: 'inclusion', criterion: 'Able to provide written informed consent.', logic: 'PASS if informed consent date is on or before screening.', confidence: 'high' },
    { id: 'e4', kind: 'exclusion', criterion: 'Secondary hypertension.', logic: 'FAIL if diagnosis of secondary hypertension is present.', confidence: 'medium' },
    { id: 'e5', kind: 'exclusion', criterion: 'Pregnant or breastfeeding women.', logic: 'FAIL if pregnancy test positive OR currently breastfeeding.', confidence: 'high' },
    { id: 'e6', kind: 'exclusion', criterion: 'Severe renal impairment (eGFR < 30).', logic: 'FAIL if eGFR < 30 mL/min/1.73m².', confidence: 'high' },
  ],
  findings: [
    { id: 'fnd1', title: 'Visit window disagreement', description: 'The protocol specifies a ±3 day window for Week 8, but the Schedule of Assessments lists ±5 days. Confirm the correct window before finalizing.', source: 'Protocol §6.1 vs. Schedule of Assessments', confidence: 'high', severity: 'blocker', suggestedAction: 'block', resolved: false },
    { id: 'fnd2', title: 'Missing ECG at Week 8', description: 'An ECG is collected at Screening and End of Treatment but not at Week 8. Verify whether an interim ECG is expected.', source: 'Schedule of Assessments', confidence: 'medium', severity: 'warning', suggestedAction: 'review', resolved: false },
    { id: 'fnd3', title: 'Eligibility BP range overlap', description: 'Inclusion requires systolic BP 140–179 mmHg; the vital-signs edit check allows up to 250 mmHg. This is expected (recording vs. eligibility) but flagged for awareness.', source: 'Protocol §3 vs. Vital Signs form', confidence: 'low', severity: 'info', suggestedAction: 'review', resolved: false },
  ],
};
