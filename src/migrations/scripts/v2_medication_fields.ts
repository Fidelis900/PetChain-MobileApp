import { getAllMedications, upsertMedication } from '../../services/localDB';
import type { Migration } from '../types';

type MedRecord = {
  id: string;
  prescriberInfo?: unknown;
  pharmacyInfo?: unknown;
  [k: string]: unknown;
};

const migration: Migration = {
  version: 2,
  description: 'Backfill prescriberInfo and pharmacyInfo on medication records',

  async up() {
    const meds = (await getAllMedications()) as MedRecord[];
    for (const med of meds) {
      let dirty = false;
      if (!med.prescriberInfo) {
        med.prescriberInfo = { name: '', contact: '', clinic: '' };
        dirty = true;
      }
      if (!med.pharmacyInfo) {
        med.pharmacyInfo = { name: '', phone: '', address: '' };
        dirty = true;
      }
      if (dirty) await upsertMedication(med);
    }
  },

  async down() {
    const meds = (await getAllMedications()) as MedRecord[];
    for (const med of meds) {
      const { prescriberInfo: _p, pharmacyInfo: _ph, ...rest } = med;
      await upsertMedication(rest);
    }
  },
};

export default migration;
