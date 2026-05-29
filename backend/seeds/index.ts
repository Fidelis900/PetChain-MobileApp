import { seed } from './seedData';
import { closePool } from '../src/db';

// CLI entry point: `ts-node seeds/index.ts [--owners N] [--vets N] [--pets N] [--records N] [--appointments N] [--medications N]`
async function main() {
  const args = process.argv.slice(2);
  const config: Record<string, number> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = parseInt(args[i + 1], 10);

    if (!isNaN(value)) {
      const configKey =
        key === 'owners'
          ? 'numOwners'
          : key === 'vets'
            ? 'numVets'
            : key === 'pets'
              ? 'petsPerOwner'
              : key === 'records'
                ? 'recordsPerPet'
                : key === 'appointments'
                  ? 'appointmentsPerPet'
                  : key === 'medications'
                    ? 'medicationsPerPet'
                    : null;

      if (configKey) {
        config[configKey] = value;
      }
    }
  }

  try {
    await seed(config);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await closePool();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { seed };
