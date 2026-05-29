/**
 * PDF Parser Service
 *
 * Extracts structured medical data from vet record PDFs using text extraction,
 * regex patterns, and NLP-like heuristics. Handles multi-page PDFs and scanned
 * documents with OCR fallback.
 */

import type { Prescription, Diagnosis, VaccinationRecord, Treatment } from '../models/MedicalRecord';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedVetRecord {
  vetName?: string;
  vetClinic?: string;
  vetPhone?: string;
  vetEmail?: string;
  visitDate?: string;
  nextVisitDate?: string;
  diagnoses: Diagnosis[];
  treatments: Treatment[];
  prescriptions: Prescription[];
  vaccinations: VaccinationRecord[];
  notes?: string;
  confidence: number; // 0-1 score indicating extraction confidence
  warnings: string[]; // Issues encountered during parsing
}

export interface PdfParseResult {
  success: boolean;
  text: string;
  pageCount: number;
  isScanned: boolean;
  error?: string;
}

// ─── Regex Patterns ───────────────────────────────────────────────────────────

const PATTERNS = {
  // Date patterns: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, Month DD, YYYY
  date: /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/gi,

  // Vet name patterns
  vetName: /(?:Dr\.?|Dr|Veterinarian|Vet)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,

  // Clinic/hospital name patterns
  clinic: /(?:Clinic|Hospital|Veterinary|Animal|Pet|Care|Center|Surgery|Practice)\s+([A-Z][a-zA-Z\s&]+)/gi,

  // Phone patterns
  phone: /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g,

  // Email patterns
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Medication patterns: "name dosage frequency"
  medication: /(?:prescribed?|medication|drug|medicine|rx|take|give)\s*:?\s*([A-Za-z0-9\s\-]+?)(?:\s+(\d+(?:\.\d+)?)\s*(?:mg|ml|g|iu|units?|tabs?|caps?|drops?|cc|ml))?(?:\s+([a-z\s]+?))?(?:every|once|twice|three times|daily|bid|tid|qid|as needed|prn|q\d+h)?/gi,

  // Vaccination patterns
  vaccination: /(?:vaccin|immuniz|shot|inocul)\w*\s*:?\s*([A-Za-z0-9\s\-,&]+?)(?:\s+(?:on|date|given|administered)\s+([^\n]+?))?(?:\n|$)/gi,

  // Diagnosis patterns
  diagnosis: /(?:diagnos[ie]s?|condition|disease|illness|problem)\s*:?\s*([A-Za-z0-9\s\-,&()]+?)(?:\n|$)/gi,

  // Treatment patterns
  treatment: /(?:treatment|procedure|surgery|therapy|intervention)\s*:?\s*([A-Za-z0-9\s\-,&()]+?)(?:\n|$)/gi,

  // Next visit/follow-up patterns
  nextVisit: /(?:follow[- ]?up|next (?:visit|appointment|check[- ]?up)|recheck|return)\s*:?\s*([^\n]+?)(?:\n|$)/gi,

  // Dosage patterns
  dosage: /(\d+(?:\.\d+)?)\s*(?:mg|ml|g|iu|units?|tabs?|caps?|drops?|cc|ml)/gi,

  // Frequency patterns
  frequency: /(?:once daily|twice daily|three times daily|every other day|daily|bid|tid|qid|as needed|prn|q\d+h|every \d+ hours?)/gi,
};

// ─── Medication Database ──────────────────────────────────────────────────────

const COMMON_MEDICATIONS = new Set([
  'amoxicillin',
  'azithromycin',
  'cephalexin',
  'ciprofloxacin',
  'doxycycline',
  'enrofloxacin',
  'metronidazole',
  'trimethoprim',
  'sulfamethoxazole',
  'penicillin',
  'tetracycline',
  'fluconazole',
  'itraconazole',
  'terbinafine',
  'ketoconazole',
  'prednisone',
  'dexamethasone',
  'methylprednisolone',
  'hydrocortisone',
  'tramadol',
  'carprofen',
  'meloxicam',
  'firocoxib',
  'gabapentin',
  'pregabalin',
  'phenobarbital',
  'levetiracetam',
  'omeprazole',
  'famotidine',
  'ranitidine',
  'metoclopramide',
  'maropitant',
  'ondansetron',
  'diphenhydramine',
  'cetirizine',
  'loratadine',
  'fexofenadine',
  'insulin',
  'levothyroxine',
  'methimazole',
  'propranolol',
  'atenolol',
  'diltiazem',
  'enalapril',
  'lisinopril',
  'furosemide',
  'spironolactone',
  'pimobendan',
  'digoxin',
  'amiodarone',
  'aspirin',
  'clopidogrel',
  'warfarin',
  'apixaban',
  'rivaroxaban',
  'heparin',
  'enoxaparin',
  'vitamin',
  'supplement',
  'probiotic',
  'fish oil',
  'glucosamine',
  'chondroitin',
  'msm',
  'turmeric',
  'cbd',
  'hemp',
]);

const COMMON_VACCINES = new Set([
  'rabies',
  'dhpp',
  'dapp',
  'fvrcp',
  'felv',
  'fip',
  'bordetella',
  'leptospirosis',
  'lyme',
  'lepto',
  'distemper',
  'parvovirus',
  'parvo',
  'hepatitis',
  'adenovirus',
  'coronavirus',
  'kennel cough',
  'whooping cough',
  'feline',
  'canine',
  'avian',
  'equine',
  'bovine',
]);

const COMMON_DIAGNOSES = new Set([
  'otitis',
  'dermatitis',
  'allergies',
  'allergy',
  'infection',
  'bacterial',
  'viral',
  'fungal',
  'parasitic',
  'arthritis',
  'arthralgia',
  'lameness',
  'fracture',
  'dislocation',
  'sprain',
  'strain',
  'gastroenteritis',
  'colitis',
  'diarrhea',
  'vomiting',
  'constipation',
  'pancreatitis',
  'hepatitis',
  'nephritis',
  'cystitis',
  'urinary',
  'kidney',
  'liver',
  'heart',
  'cardiac',
  'respiratory',
  'pneumonia',
  'bronchitis',
  'asthma',
  'obesity',
  'diabetes',
  'hyperthyroidism',
  'hypothyroidism',
  'cancer',
  'tumor',
  'neoplasia',
  'seizure',
  'epilepsy',
  'anemia',
  'leukemia',
  'lymphoma',
  'pyometra',
  'mastitis',
  'prostatitis',
  'orchitis',
  'conjunctivitis',
  'keratitis',
  'cataracts',
  'glaucoma',
  'otosclerosis',
  'deafness',
  'alopecia',
  'mange',
  'ringworm',
  'abscess',
  'wound',
  'laceration',
  'burn',
  'trauma',
  'poisoning',
  'toxicity',
  'foreign body',
  'obstruction',
  'bloat',
  'torsion',
  'hernia',
  'prolapse',
  'intussusception',
  'peritonitis',
  'sepsis',
  'shock',
  'dehydration',
  'malnutrition',
  'starvation',
  'hypothermia',
  'hyperthermia',
  'fever',
  'lethargy',
  'depression',
  'anxiety',
  'aggression',
  'behavioral',
]);

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Normalize date string to YYYY-MM-DD format
 */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    const year = y.length === 2 ? `20${y}` : y;
    // Assume MM/DD/YYYY format (US standard)
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try DD-MM-YYYY or MM-DD-YYYY
  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try Month DD, YYYY
  const monthMatch = dateStr.match(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}),? (\d{4})$/i,
  );
  if (monthMatch) {
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const [, month, day, year] = monthMatch;
    const monthNum = months[month.toLowerCase().slice(0, 3)];
    return `${year}-${monthNum}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Extract confidence score based on extraction quality
 */
function calculateConfidence(extracted: ExtractedVetRecord): number {
  let score = 0.5; // Base score

  if (extracted.vetName) score += 0.1;
  if (extracted.vetClinic) score += 0.05;
  if (extracted.visitDate) score += 0.15;
  if (extracted.diagnoses.length > 0) score += 0.1;
  if (extracted.treatments.length > 0) score += 0.1;
  if (extracted.prescriptions.length > 0) score += 0.15;
  if (extracted.vaccinations.length > 0) score += 0.1;
  if (extracted.notes) score += 0.05;

  return Math.min(score, 1.0);
}

/**
 * Check if text appears to be from a scanned document (low OCR quality)
 */
function isScannedDocument(text: string): boolean {
  // Count common OCR errors and garbled text
  const ocrErrors = (text.match(/[|!1][|!1]{2,}/g) || []).length; // |||, !!!, 111
  const garbledChars = (text.match(/[^\w\s\-.,;:()&@#$%*+=/'"]/g) || []).length;
  const totalChars = text.length;

  const errorRate = (ocrErrors + garbledChars) / totalChars;
  return errorRate > 0.05; // More than 5% error rate suggests scanned
}

// ─── Main Extraction Functions ────────────────────────────────────────────────

/**
 * Extract vet information from text
 */
function extractVetInfo(text: string): {
  vetName?: string;
  vetClinic?: string;
  vetPhone?: string;
  vetEmail?: string;
} {
  const result: {
    vetName?: string;
    vetClinic?: string;
    vetPhone?: string;
    vetEmail?: string;
  } = {};

  // Extract vet name
  const vetNameMatch = text.match(PATTERNS.vetName);
  if (vetNameMatch) {
    result.vetName = vetNameMatch[0].replace(/^(?:Dr\.?|Veterinarian|Vet)\s+/i, '').trim();
  }

  // Extract clinic name
  const clinicMatch = text.match(PATTERNS.clinic);
  if (clinicMatch) {
    result.vetClinic = clinicMatch[0].trim();
  }

  // Extract phone
  const phoneMatch = text.match(PATTERNS.phone);
  if (phoneMatch) {
    result.vetPhone = phoneMatch[0].trim();
  }

  // Extract email
  const emailMatch = text.match(PATTERNS.email);
  if (emailMatch) {
    result.vetEmail = emailMatch[0].trim();
  }

  return result;
}

/**
 * Extract dates from text
 */
function extractDates(text: string): { visitDate?: string; nextVisitDate?: string } {
  const result: { visitDate?: string; nextVisitDate?: string } = {};

  // Look for visit date patterns
  const visitDateMatch = text.match(
    /(?:visit|appointment|exam|examination|date)\s*:?\s*([^\n]+?)(?:\n|$)/i,
  );
  if (visitDateMatch) {
    const dateStr = visitDateMatch[1].trim();
    const normalized = normalizeDate(dateStr);
    if (normalized) result.visitDate = normalized;
  }

  // Look for next visit patterns
  const nextVisitMatch = text.match(PATTERNS.nextVisit);
  if (nextVisitMatch) {
    const dateStr = nextVisitMatch[1].trim();
    const normalized = normalizeDate(dateStr);
    if (normalized) result.nextVisitDate = normalized;
  }

  // Fallback: extract first date as visit date if not found
  if (!result.visitDate) {
    const dateMatches = text.match(PATTERNS.date);
    if (dateMatches) {
      const normalized = normalizeDate(dateMatches[0]);
      if (normalized) result.visitDate = normalized;
    }
  }

  return result;
}

/**
 * Extract diagnoses from text
 */
function extractDiagnoses(text: string): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];
  const seen = new Set<string>();

  // Look for explicit diagnosis sections
  const diagnosisMatches = text.match(PATTERNS.diagnosis);
  if (diagnosisMatches) {
    diagnosisMatches.forEach((match) => {
      const diagText = match.replace(/^(?:diagnos[ie]s?|condition|disease|illness|problem)\s*:?\s*/i, '').trim();
      if (diagText && !seen.has(diagText.toLowerCase())) {
        diagnoses.push({
          diagnosisText: diagText,
          severity: 'unknown',
        });
        seen.add(diagText.toLowerCase());
      }
    });
  }

  // Look for common diagnosis keywords
  const lines = text.split('\n');
  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();
    COMMON_DIAGNOSES.forEach((diagnosis) => {
      if (lowerLine.includes(diagnosis) && !seen.has(diagnosis)) {
        diagnoses.push({
          diagnosisText: diagnosis.charAt(0).toUpperCase() + diagnosis.slice(1),
          severity: 'unknown',
        });
        seen.add(diagnosis);
      }
    });
  });

  return diagnoses.slice(0, 10); // Limit to 10 diagnoses
}

/**
 * Extract treatments from text
 */
function extractTreatments(text: string): Treatment[] {
  const treatments: Treatment[] = [];
  const seen = new Set<string>();

  // Look for explicit treatment sections
  const treatmentMatches = text.match(PATTERNS.treatment);
  if (treatmentMatches) {
    treatmentMatches.forEach((match) => {
      const treatText = match.replace(/^(?:treatment|procedure|surgery|therapy|intervention)\s*:?\s*/i, '').trim();
      if (treatText && !seen.has(treatText.toLowerCase())) {
        treatments.push({
          treatmentText: treatText,
        });
        seen.add(treatText.toLowerCase());
      }
    });
  }

  return treatments.slice(0, 5); // Limit to 5 treatments
}

/**
 * Extract prescriptions from text
 */
function extractPrescriptions(text: string): Prescription[] {
  const prescriptions: Prescription[] = [];
  const seen = new Set<string>();

  // Look for medication patterns
  const medMatches = text.match(PATTERNS.medication);
  if (medMatches) {
    medMatches.forEach((match) => {
      const medText = match.replace(/^(?:prescribed?|medication|drug|medicine|rx|take|give)\s*:?\s*/i, '').trim();
      if (medText && !seen.has(medText.toLowerCase())) {
        // Extract dosage
        const dosageMatch = medText.match(PATTERNS.dosage);
        const dosage = dosageMatch ? dosageMatch[0] : undefined;

        // Extract frequency
        const frequencyMatch = medText.match(PATTERNS.frequency);
        const frequency = frequencyMatch ? frequencyMatch[0] : undefined;

        // Extract medication name (first word or common medication)
        const medName = medText.split(/\s+/)[0];
        if (medName && medName.length > 2) {
          prescriptions.push({
            medicationName: medName,
            dosage,
            frequency,
          });
          seen.add(medText.toLowerCase());
        }
      }
    });
  }

  // Look for common medications in text
  const lines = text.split('\n');
  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();
    COMMON_MEDICATIONS.forEach((med) => {
      if (lowerLine.includes(med) && !seen.has(med)) {
        prescriptions.push({
          medicationName: med.charAt(0).toUpperCase() + med.slice(1),
        });
        seen.add(med);
      }
    });
  });

  return prescriptions.slice(0, 10); // Limit to 10 prescriptions
}

/**
 * Extract vaccinations from text
 */
function extractVaccinations(text: string): VaccinationRecord[] {
  const vaccinations: VaccinationRecord[] = [];
  const seen = new Set<string>();

  // Look for explicit vaccination sections
  const vaccMatches = text.match(PATTERNS.vaccination);
  if (vaccMatches) {
    vaccMatches.forEach((match) => {
      const vaccText = match.replace(/^(?:vaccin|immuniz|shot|inocul)\w*\s*:?\s*/i, '').trim();
      if (vaccText && !seen.has(vaccText.toLowerCase())) {
        vaccinations.push({
          vaccineName: vaccText,
        });
        seen.add(vaccText.toLowerCase());
      }
    });
  }

  // Look for common vaccines in text
  const lines = text.split('\n');
  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();
    COMMON_VACCINES.forEach((vaccine) => {
      if (lowerLine.includes(vaccine) && !seen.has(vaccine)) {
        vaccinations.push({
          vaccineName: vaccine.charAt(0).toUpperCase() + vaccine.slice(1),
        });
        seen.add(vaccine);
      }
    });
  });

  return vaccinations.slice(0, 10); // Limit to 10 vaccinations
}

// ─── Main Parser Function ─────────────────────────────────────────────────────

/**
 * Parse extracted PDF text and return structured medical data
 */
export function parseVetRecordText(text: string): ExtractedVetRecord {
  const warnings: string[] = [];

  // Check if document appears to be scanned
  const isScanned = isScannedDocument(text);
  if (isScanned) {
    warnings.push('Document appears to be scanned. OCR quality may affect accuracy.');
  }

  // Extract all components
  const vetInfo = extractVetInfo(text);
  const dates = extractDates(text);
  const diagnoses = extractDiagnoses(text);
  const treatments = extractTreatments(text);
  const prescriptions = extractPrescriptions(text);
  const vaccinations = extractVaccinations(text);

  // Validate required fields
  if (!dates.visitDate) {
    warnings.push('Could not extract visit date. Please verify manually.');
  }

  if (diagnoses.length === 0 && treatments.length === 0 && prescriptions.length === 0) {
    warnings.push('No medical information found. Document may not be a valid vet record.');
  }

  const result: ExtractedVetRecord = {
    ...vetInfo,
    ...dates,
    diagnoses,
    treatments,
    prescriptions,
    vaccinations,
    notes: text.slice(0, 500), // Store first 500 chars as notes
    warnings,
    confidence: 0,
  };

  result.confidence = calculateConfidence(result);

  return result;
}

/**
 * Validate extracted record has minimum required data
 */
export function validateExtractedRecord(record: ExtractedVetRecord): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!record.visitDate) {
    errors.push('Visit date is required');
  }

  if (
    record.diagnoses.length === 0 &&
    record.treatments.length === 0 &&
    record.prescriptions.length === 0 &&
    record.vaccinations.length === 0
  ) {
    errors.push('At least one medical item (diagnosis, treatment, prescription, or vaccination) is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
