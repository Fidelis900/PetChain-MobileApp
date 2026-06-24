# PDF Import Setup & Testing Guide

This guide covers setup, configuration, and testing of the PDF vet record import pipeline.

## Installation

### 1. Install Dependencies

```bash
npm install pdf-parse tesseract.js
```

**Optional:** For better OCR performance, install Tesseract language data:
```bash
npm install tesseract.js-core
```

### 2. Verify Installation

```bash
npm list pdf-parse tesseract.js
```

Expected output:
```
├── pdf-parse@1.1.1
└── tesseract.js@5.0.4
```

## Configuration

### Environment Variables

No additional environment variables required. The system uses defaults:

```typescript
// PDF Extraction defaults
maxPages: 20
timeout: 30000 (30 seconds)
maxSizeMb: 10

// API defaults
enableOcr: false (can be enabled per request)
```

### Optional: Configure Tesseract Language

For non-English PDFs, configure language:

```typescript
// In pdfExtractionService.ts
const worker = await Tesseract.createWorker('eng+fra'); // English + French
```

## Testing

### Unit Tests

Create test file: `backend/services/__tests__/pdfParserService.test.ts`

```typescript
import { parseVetRecordText, validateExtractedRecord } from '../pdfParserService';

describe('PDF Parser Service', () => {
  describe('parseVetRecordText', () => {
    it('should extract vet information', () => {
      const text = `
        Dr. Smith
        Animal Hospital
        (555) 123-4567
        smith@animalhospital.com
        
        Visit Date: 2024-05-28
        Next Visit: 2024-06-28
        
        Diagnosis: Otitis
        Treatment: Antibiotic therapy
        Medication: Amoxicillin 500mg twice daily
        Vaccination: Rabies
      `;

      const result = parseVetRecordText(text);

      expect(result.vetName).toBe('Smith');
      expect(result.vetClinic).toContain('Animal Hospital');
      expect(result.vetPhone).toContain('555');
      expect(result.visitDate).toBe('2024-05-28');
      expect(result.diagnoses.length).toBeGreaterThan(0);
      expect(result.prescriptions.length).toBeGreaterThan(0);
      expect(result.vaccinations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle missing fields', () => {
      const text = 'Diagnosis: Otitis\nTreatment: Antibiotics';
      const result = parseVetRecordText(text);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('visit date');
    });

    it('should validate extracted records', () => {
      const record = {
        vetName: 'Dr. Smith',
        diagnoses: [{ diagnosisText: 'Otitis', severity: 'unknown' }],
        treatments: [],
        prescriptions: [],
        vaccinations: [],
        confidence: 0.8,
        warnings: [],
      };

      const validation = validateExtractedRecord(record);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('Visit date');
    });
  });
});
```

Run tests:
```bash
npm run test -- pdfParserService.test.ts
```

### Integration Tests

Create test file: `backend/server/routes/__tests__/import.test.ts`

```typescript
import request from 'supertest';
import { createApp } from '../../app';

describe('PDF Import Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/import/medical-records/parse-pdf', () => {
    it('should parse a valid PDF', async () => {
      const pdfBase64 = 'JVBERi0xLjQK...'; // Valid PDF base64

      const response = await request(app)
        .post('/api/import/medical-records/parse-pdf')
        .set('Authorization', 'Bearer mock-vet-id')
        .send({
          pdfBase64,
          petId: 'pet-123',
          enableOcr: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.visitDate).toBeDefined();
    });

    it('should reject invalid PDF', async () => {
      const response = await request(app)
        .post('/api/import/medical-records/parse-pdf')
        .set('Authorization', 'Bearer mock-vet-id')
        .send({
          pdfBase64: 'invalid-base64',
          petId: 'pet-123',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(false);
      expect(response.body.data.error).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/import/medical-records/parse-pdf')
        .send({
          pdfBase64: 'JVBERi0xLjQK...',
          petId: 'pet-123',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/import/medical-records/confirm', () => {
    it('should save extracted record', async () => {
      const response = await request(app)
        .post('/api/import/medical-records/confirm')
        .set('Authorization', 'Bearer mock-vet-id')
        .send({
          petId: 'pet-123',
          type: 'checkup',
          visitDate: '2024-05-28',
          diagnoses: [{ diagnosisText: 'Otitis', severity: 'unknown' }],
          treatments: [],
          prescriptions: [
            { medicationName: 'Amoxicillin', dosage: '500mg', frequency: 'twice daily' },
          ],
          vaccinations: [],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.diagnoses).toBe(1);
      expect(response.body.data.prescriptions).toBe(1);
    });

    it('should require visit date', async () => {
      const response = await request(app)
        .post('/api/import/medical-records/confirm')
        .set('Authorization', 'Bearer mock-vet-id')
        .send({
          petId: 'pet-123',
          type: 'checkup',
          diagnoses: [],
          treatments: [],
          prescriptions: [],
          vaccinations: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('visitDate');
    });
  });
});
```

Run tests:
```bash
npm run test -- import.test.ts
```

### Manual Testing

#### Test 1: Text-Based PDF

1. Create a simple PDF with vet record content
2. Convert to base64:
   ```bash
   base64 -i vet_record.pdf -o vet_record.b64
   ```
3. Test via API:
   ```bash
   curl -X POST http://localhost:3000/api/import/medical-records/parse-pdf \
     -H "Authorization: Bearer mock-vet-id" \
     -H "Content-Type: application/json" \
     -d '{
       "pdfBase64": "'"$(cat vet_record.b64)"'",
       "petId": "pet-123",
       "enableOcr": false
     }'
   ```

#### Test 2: Scanned Document

1. Scan a vet record or use a scanned PDF
2. Convert to base64
3. Test with OCR enabled:
   ```bash
   curl -X POST http://localhost:3000/api/import/medical-records/parse-pdf \
     -H "Authorization: Bearer mock-vet-id" \
     -H "Content-Type: application/json" \
     -d '{
       "pdfBase64": "'"$(cat scanned_record.b64)"'",
       "petId": "pet-123",
       "enableOcr": true
     }'
   ```

#### Test 3: Frontend Import Flow

1. Start the app:
   ```bash
   npm start
   ```

2. Navigate to a pet's medical records
3. Tap "Import Record"
4. Select "PDF File"
5. Paste base64-encoded PDF
6. Review extracted data
7. Edit fields as needed
8. Confirm and save

### Test Data

#### Sample Vet Record Text

```
ANIMAL HOSPITAL
123 Main Street
Anytown, USA 12345
Phone: (555) 123-4567
Email: info@animalhospital.com

MEDICAL RECORD

Patient: Fluffy
Species: Cat
Breed: Persian
Date of Birth: 2020-01-15

Veterinarian: Dr. Sarah Smith, DVM
License #: VET-12345

Visit Date: May 28, 2024
Next Visit: June 28, 2024

DIAGNOSIS:
- Otitis (ear infection)
- Mild dermatitis

TREATMENT:
- Antibiotic therapy
- Topical ear medication
- Dietary adjustment

MEDICATIONS:
1. Amoxicillin 500mg - twice daily for 10 days
2. Otomax ear drops - twice daily for 7 days
3. Omega-3 supplement - once daily

VACCINATIONS:
- Rabies (current)
- FVRCP (current)

NOTES:
Patient presented with ear scratching and mild skin irritation. 
Prescribed antibiotics and topical treatment. 
Recommend dietary change to reduce inflammation.
Follow-up in 2 weeks to assess response to treatment.

Dr. Sarah Smith, DVM
Animal Hospital
```

#### Sample PDF Creation

Create a test PDF with Python:

```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def create_test_pdf(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    c.drawString(100, 750, "ANIMAL HOSPITAL")
    c.drawString(100, 730, "123 Main Street")
    c.drawString(100, 710, "Phone: (555) 123-4567")
    c.drawString(100, 690, "")
    c.drawString(100, 670, "MEDICAL RECORD")
    c.drawString(100, 650, "")
    c.drawString(100, 630, "Patient: Fluffy")
    c.drawString(100, 610, "Veterinarian: Dr. Sarah Smith")
    c.drawString(100, 590, "Visit Date: May 28, 2024")
    c.drawString(100, 570, "")
    c.drawString(100, 550, "DIAGNOSIS:")
    c.drawString(120, 530, "- Otitis (ear infection)")
    c.drawString(100, 510, "")
    c.drawString(100, 490, "MEDICATIONS:")
    c.drawString(120, 470, "- Amoxicillin 500mg twice daily")
    c.drawString(100, 450, "")
    c.drawString(100, 430, "VACCINATIONS:")
    c.drawString(120, 410, "- Rabies")
    c.save()

create_test_pdf('test_vet_record.pdf')
```

## Troubleshooting

### Issue: "pdf-parse library not installed"

**Solution:**
```bash
npm install pdf-parse
```

### Issue: "tesseract.js library not installed"

**Solution:**
```bash
npm install tesseract.js
```

### Issue: OCR is very slow

**Causes:**
- Large PDF file
- Many pages
- Low-quality scanned image

**Solutions:**
- Reduce PDF size
- Limit to fewer pages
- Improve scan quality
- Use text-based PDF instead

### Issue: Low extraction confidence

**Causes:**
- Unusual PDF format
- Poor scan quality
- Non-standard field names

**Solutions:**
- Review and edit extracted data manually
- Use OCR for scanned documents
- Provide feedback for improvement

### Issue: Incorrect medication extraction

**Causes:**
- Medication name not in database
- Unusual dosage format
- Abbreviations not recognized

**Solutions:**
- Add medication to database
- Manually edit extracted data
- Improve regex patterns

## Performance Optimization

### Caching

Cache extraction results to avoid re-parsing:

```typescript
const cache = new Map<string, ExtractedVetRecord>();

async function parseWithCache(pdfBase64: string): Promise<ExtractedVetRecord> {
  const hash = crypto.createHash('sha256').update(pdfBase64).digest('hex');
  
  if (cache.has(hash)) {
    return cache.get(hash)!;
  }
  
  const result = await extractAndParse(pdfBase64);
  cache.set(hash, result);
  return result;
}
```

### Batch Processing

Process multiple PDFs in parallel:

```typescript
async function processBatch(pdfList: string[]): Promise<ExtractedVetRecord[]> {
  return Promise.all(
    pdfList.map(pdf => parseVetRecordText(pdf))
  );
}
```

### Compression

Compress PDFs before upload:

```bash
# Using ghostscript
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/ebook \
   -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=output.pdf input.pdf
```

## Monitoring

### Logging

Enable detailed logging:

```typescript
// In pdfExtractionService.ts
console.log('[PDF Extraction]', {
  pageCount: data.numPages,
  textLength: text.length,
  isScanned,
  processingTime: Date.now() - startTime,
});
```

### Metrics

Track extraction metrics:

```typescript
interface ExtractionMetrics {
  totalRequests: number;
  successfulExtractions: number;
  failedExtractions: number;
  averageConfidence: number;
  averageProcessingTime: number;
  ocrUsageRate: number;
}
```

## Related Documentation

- [PDF Import Overview](./PDF-IMPORT.md)
- [API Documentation](../backend/docs/openapi.json)
- [Testing Guide](../CONTRIBUTING.md)

---

**Last Updated:** May 28, 2026
**Maintained By:** PetChain Development Team
