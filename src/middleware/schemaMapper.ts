import { type AxiosResponse } from 'axios';

/**
 * Registry of mappers for different API endpoints or data structures.
 * This allows the app to handle legacy data formats gracefully.
 */

type MapperFunction = (data: any) => any;

const mappers: Record<string, MapperFunction> = {
  /**
   * Example: Normalize Pet object.
   * Handles legacy field names like 'pet_name' or missing 'species'.
   */
  '/pets': (data: any) => {
    if (Array.isArray(data)) {
      return data.map(mapPet);
    }
    return mapPet(data);
  },

  '/pets/:id': (data: any) => mapPet(data),

  /**
   * Add more mappers as the API evolves...
   */
};

function mapPet(pet: any) {
  if (!pet) return pet;

  // Backward compatibility: pet_name -> name
  if (pet.pet_name && !pet.name) {
    pet.name = pet.pet_name;
  }

  // Ensure mandatory fields have defaults if missing in older API versions
  if (!pet.species) {
    pet.species = 'other';
  }

  // Resilient parsing: Ensure dates are handled or defaulted
  if (!pet.createdAt) {
    pet.createdAt = new Date().toISOString();
  }

  return pet;
}

/**
 * Interceptor logic to apply mappers to responses.
 */
export const applySchemaMapping = (response: AxiosResponse): AxiosResponse => {
  const { config, data } = response;
  const url = config.url || '';

  // Find a matching mapper for the URL
  // (Simplistic matching for demo: exact match or startsWith)
  const mapperKey = Object.keys(mappers).find(
    (key) =>
      url.endsWith(key) ||
      (key.includes(':id') && url.match(new RegExp(key.replace(':id', '[^/]+')))),
  );

  if (mapperKey && data) {
    response.data = mappers[mapperKey](data);
  }

  return response;
};
