/**
 * Jest mock for react-native-image-resizer.
 * Uses CommonJS exports so ts-jest resolves default correctly.
 */

const mockCreateResizedImage = jest.fn().mockResolvedValue({
  uri: 'file://resized.jpg',
  size: 512,
  width: 800,
  height: 600,
});

const ImageResizer = { createResizedImage: mockCreateResizedImage };

// Support both default import and named import patterns
export default ImageResizer;
export const createResizedImage = mockCreateResizedImage;
const createResizedImage = jest.fn();

module.exports = {
  __esModule: true,
  default: { createResizedImage },
  createResizedImage,
};
