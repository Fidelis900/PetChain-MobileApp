import { getAllMedications, upsertMedication } from '../../services/localDB';
import type { Migration } from '../types';

type MedRecord = { id?: string; type?: unknown; frequency?: unknown; [k: string]: unknown };

const migration: Migration = {
  version: 3,
  description: 'Sanitize existing records for improved backward compatibility',

  async up() {
    const meds = (await getAllMedications()) as MedRecord[];
    for (const med of meds) {
      let changed = false;

      if (!med.id) {
        med.id = Math.random().toString(36).substring(7);
        changed = true;
      }

      if (!med.type) {
        med.type = 'pills';
        changed = true;
      }

      if (typeof med.frequency === 'number') {
        med.frequency = `${med.frequency}x per day`;
        changed = true;
      }

      if (changed) {
        await upsertMedication(med as { id: string; [k: string]: unknown });
      }
    }
  },

  async down() {
    console.warn('v3 down: Sanitization changes are kept for safety.');
  },
};

export default migration;
